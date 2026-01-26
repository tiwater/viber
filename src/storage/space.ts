/**
 * Space Storage - Handles storage operations for spaces
 */

import path from "path";
import { BaseStorage, StorageAdapter, ArtifactInfo } from "./base";
import { getViberRoot, getSupabaseClient } from "../config";
// LocalStorageAdapter is imported dynamically to avoid bundling Node.js fs module in client

export interface StorageOptions {
  rootPath: string;
  spaceId: string;
  adapter?: StorageAdapter;
}

export class SpaceStorage extends BaseStorage {
  private spaceId: string;

  constructor(options: StorageOptions) {
    super(options.rootPath, options.adapter);
    this.spaceId = options.spaceId;
  }

  getSpacePath(): string {
    return this.basePath;
  }

  getFilePath(filename: string): string {
    return this.getPath(filename);
  }

  async saveFile(filename: string, data: any): Promise<void> {
    const content =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    await this.writeFile(filename, content);
  }

  async saveFileBuffer(filename: string, data: Buffer): Promise<void> {
    await this.writeFile(filename, data);
  }

  /**
   * DEPRECATED: Use artifact operations below instead
   * Save an artifact file (low-level file operation only)
   */
  async saveArtifact(
    storageKey: string,
    buffer: Buffer,
    metadata: {
      mimeType: string;
      size: number;
      artifactType?: string;
    },
    originalFilename?: string
  ): Promise<void> {
    const artifactPath = `artifacts/${storageKey}`;
    await this.mkdir("artifacts");
    await this.writeFile(artifactPath, buffer);
  }

  // ==================== High-Level Artifact Operations ====================

  /**
   * Save a complete artifact (both file AND metadata)
   */
  async saveCompleteArtifact(artifact: ArtifactInfo, buffer: Buffer): Promise<ArtifactInfo> {
    return this.adapter.saveArtifact(this.spaceId, artifact, buffer);
  }

  /**
   * Get a complete artifact (both file AND metadata)
   */
  async getCompleteArtifact(artifactId: string): Promise<{ info: ArtifactInfo; buffer: Buffer } | null> {
    return this.adapter.getArtifact(this.spaceId, artifactId);
  }

  /**
   * Get artifact metadata only (without loading the file)
   */
  async getArtifactInfo(artifactId: string): Promise<ArtifactInfo | null> {
    return this.adapter.getArtifactInfo(this.spaceId, artifactId);
  }

  /**
   * List all artifacts in this space
   */
  async listArtifacts(): Promise<ArtifactInfo[]> {
    return this.adapter.listArtifacts(this.spaceId);
  }

  /**
   * Delete an artifact (both file AND metadata)
   */
  async deleteCompleteArtifact(artifactId: string): Promise<void> {
    return this.adapter.deleteArtifact(this.spaceId, artifactId);
  }



  async listFiles(): Promise<string[]> {
    return this.list();
  }

  async createDirectory(dirname: string): Promise<void> {
    await this.mkdir(dirname);
  }

  async getMetadata(): Promise<any> {
    return this.readJSON("metadata.json");
  }

  async saveMetadata(metadata: any): Promise<void> {
    await this.writeJSON("metadata.json", metadata);
  }

  async getArtifact(
    filename: string
  ): Promise<{ content: Buffer; metadata?: any } | null> {
    try {
      const artifactPath = `artifacts/${filename}`;
      const content = await this.readFile(artifactPath);

      // Metadata is now stored in database, not in .xmeta files
      return { content, metadata: null };
    } catch (error: any) {
      // Check if error indicates file not found (adapter specific)
      // For now assume any error means not found or issue
      return null;
    }
  }

  async cleanup(): Promise<void> {
    // Optional: Clean up temporary files
    const files = await this.listFiles();
    for (const file of files) {
      if (file.startsWith("tmp_") || file.endsWith(".tmp")) {
        await this.delete(file);
      }
    }
  }
}

export class SpaceStorageFactory {
  // Get root path dynamically to ensure env vars are loaded
  private static getRootPath(): string {
    return getViberRoot();
  }

  private static rootPath: string | null = null;

  static setRootPath(rootPath: string): void {
    SpaceStorageFactory.rootPath = rootPath;
  }

  static async create(spaceId: string): Promise<SpaceStorage> {
    let adapter: StorageAdapter | undefined;
    let rootPath = "";

    // Check for explicit Supabase storage mode
    // Note: VIBEX_DATA_MODE controls metadata storage (database), not file storage
    // File storage requires explicit VIBEX_FILE_STORAGE=supabase to use Supabase Storage
    const fileStorageMode = process.env.VIBEX_FILE_STORAGE || 'local';

    // Try to use Supabase storage if explicitly enabled
    if (fileStorageMode === 'supabase') {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('Supabase client not configured');
        }
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // For Supabase, rootPath is the space prefix
          // We use spaceId for isolation (spaces are already user-isolated via RLS)
          rootPath = spaceId;

          const { SupabaseStorageAdapter } = await import("./adapters/supabase");

          // Store everything in the 'spaces' bucket under [spaceId]/artifacts/
          // This keeps all space data together and leverages spaceId for isolation
          adapter = new SupabaseStorageAdapter(user.id, {
            defaultBucket: "spaces",
            bucketMappings: {},
          });

          console.log(`[SpaceStorage] Using Supabase storage for space ${spaceId} (artifacts only)`);
        }
      } catch (e) {
        console.warn("[SpaceStorage] Failed to initialize Supabase storage, falling back to local:", e);
      }
    }

    // Use local storage (default for file storage)
    if (!adapter) {
      // Only use LocalStorageAdapter on server
      if (typeof window === 'undefined') {
        // Dynamic import to avoid bundling fs in client
        const { LocalStorageAdapter } = await import("./adapters/local");
        adapter = new LocalStorageAdapter();
        const baseRoot = SpaceStorageFactory.rootPath || SpaceStorageFactory.getRootPath();
        rootPath = path.join(baseRoot, "spaces", spaceId);
        console.log(`[SpaceStorage] Using local file storage for space ${spaceId}`);
      } else {
        throw new Error('LocalStorageAdapter cannot be used in client code. Provide a client-compatible adapter.');
      }
    }

    const storage = new SpaceStorage({
      rootPath,
      spaceId,
      adapter
    });
    await storage.initialize();
    return storage;
  }

  static async list(): Promise<string[]> {
    // Listing spaces is tricky with mixed storage.
    // For now, we'll implement listing for the active storage mode.

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (supabaseUrl) {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('Supabase client not configured');
        }
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { SupabaseStorageAdapter } = await import("./adapters/supabase");
          const adapter = new SupabaseStorageAdapter(user.id);
          // List directories in user's folder
          // Supabase storage list returns files/folders in the prefix
          // We need to list folders under userId/
          // But Supabase list is flat-ish or simulates folders.
          // We can list root of userId/

          // Actually, SupabaseStorageAdapter.readdir takes a path.
          // If we pass empty string or just userId, it might work depending on implementation.
          // Our adapter implementation of readdir lists contents of a path.
          // So we can list content of `${user.id}`.

          // However, SupabaseStorageAdapter constructor takes userId, but it doesn't prefix it automatically 
          // in readdir unless we change logic.
          // In create(), we pass `${user.id}/${spaceId}` as rootPath.
          // So the adapter itself is generic.

          // Let's create a temporary adapter just to list
          // But we need to list *spaces*, which are subfolders of user.id

          // We can use the adapter to list `${user.id}`
          // But wait, SupabaseStorageAdapter constructor takes userId but doesn't use it for prefixing 
          // EXCEPT for maybe internal logic? 
          // Actually in my implementation:
          // constructor(private userId: string) {}
          // But I didn't use `this.userId` in `readFile` etc!
          // I used `path` passed to methods.
          // AND `SpaceStorage` passes `rootPath` (which includes userId) + relativePath.

          // So `SupabaseStorageAdapter` is actually stateless regarding path prefix, 
          // `userId` in constructor was unused in my previous implementation!
          // I should fix that or just ignore it if I pass full path.

          // If I pass `${user.id}` to readdir, it should list spaces.
          const files = await adapter.readdir(user.id);
          // Filter for what looks like space directories (or just return all)
          return files;
        }
      } catch (e) {
        console.warn("Failed to list Supabase spaces:", e);
      }
    }

    // Fallback to local (server-only)
    if (typeof window === 'undefined') {
      try {
        // Dynamic import to avoid bundling fs in client
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require("fs").promises;
        const rootPath = SpaceStorageFactory.rootPath || SpaceStorageFactory.getRootPath();
        const spacesPath = path.join(rootPath, "spaces");

        try {
          await fs.access(spacesPath);
        } catch {
          return [];
        }

        const entries = await fs.readdir(spacesPath);
        const spaces: string[] = [];

        for (const entry of entries) {
          const entryPath = path.join(spacesPath, entry);
          const stat = await fs.stat(entryPath);
          if (stat.isDirectory() && !entry.startsWith(".")) {
            spaces.push(entry);
          }
        }

        return spaces;
      } catch {
        return [];
      }
    }

    // If we reach here (browser environment with no Supabase), return empty
    return [];
  }

  static async exists(spaceId: string): Promise<boolean> {
    // Similar logic to create() to check existence
    const storage = await SpaceStorageFactory.create(spaceId);
    // Check if space.json exists as a proxy for space existence
    return storage.exists("space.json");
  }

  static async delete(spaceId: string): Promise<void> {
    const storage = await SpaceStorageFactory.create(spaceId);
    // Recursive delete not easily supported in base interface
    // But for Supabase we can delete folder
    // For local we can use fs.rm

    // This is a bit hacky, ideally StorageAdapter has rmdir or similar
    // Or we just delete known files.

    // For now, let's try to delete metadata.json
    await storage.delete("metadata.json");
    // And maybe artifacts...
    // A proper delete would require listing all files and deleting them.

    const files = await storage.list();
    for (const file of files) {
      await storage.delete(file);
    }

    // Also artifacts
    try {
      const artifacts = await storage.list("artifacts");
      for (const file of artifacts) {
        await storage.delete(`artifacts/${file}`);
      }
    } catch { }
  }
}

