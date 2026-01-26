/**
 * ViberDataManager - Unified Data Access Layer
 *
 * This is the single source of truth for all Viber data operations.
 * It unifies DataAdapter (metadata) and SpaceStorage (files) into one interface.
 *
 * Key features:
 * - Unified query interface for spaces, artifacts, tasks, agents, tools
 * - Automatic caching
 * - Real-time subscriptions (when supported)
 * - Optimistic updates
 */

import type { DataAdapter } from "./adapter";
import type { Space as DataSpace, Artifact, Task, Agent, Tool } from "./types";
import { getDataAdapter, getServerDataAdapter } from "./factory";
import { SpaceStorage, SpaceStorageFactory } from "../storage/space";
import type { Space } from "../core/space";
import type { SpaceStorage as SpaceStorageType } from "../storage/space";

export interface SpaceFilters {
  userId?: string;
  name?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ArtifactFilters {
  spaceId?: string;
  taskId?: string;
  category?: "input" | "intermediate" | "output";
  mimeType?: string;
}

export interface TaskFilters {
  spaceId: string;
  status?: "active" | "completed" | "archived";
  createdAfter?: Date;
}

export type Unsubscribe = () => void;
export type SubscriptionCallback<T> = (data: T) => void;

/**
 * ViberDataManager - Central data access layer
 */
export class ViberDataManager {
  private dataAdapter: DataAdapter;
  private cache: Map<string, { data: any; timestamp: number }>;
  private subscriptions: Map<string, Set<SubscriptionCallback<any>>>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes default

  constructor(dataAdapter?: DataAdapter) {
    // If no adapter provided, try to get one from factory
    // Note: This will fail for database mode on client side, which is intended
    // as client side should use server actions, not ViberDataManager directly
    this.dataAdapter = dataAdapter || getDataAdapter();
    this.cache = new Map();
    this.subscriptions = new Map();
  }

  /**
   * Create a server-side instance (uses direct database access)
   * Uses dynamic import to avoid bundling server code in client
   *
   * NOTE: This should only be called from server-side code (API routes, server components)
   */
  static async createServer(): Promise<ViberDataManager> {
    // Dynamic import to avoid bundling server code in client bundle
    const { getServerDataAdapter } = await import("./factory");
    return new ViberDataManager(getServerDataAdapter());
  }

  /**
   * Create a server-side instance synchronously (for use in server contexts)
   * This uses require() to avoid bundling in client code
   */
  static createServerSync(): ViberDataManager {
    if (typeof window !== "undefined") {
      throw new Error("createServerSync() can only be called on the server");
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getServerDataAdapter } = require("./factory");
    return new ViberDataManager(getServerDataAdapter());
  }

  /**
   * Create a client-side instance (uses API calls)
   * @deprecated Client-side direct usage is deprecated. Use server actions instead.
   */
  static createClient(): ViberDataManager {
    // Return a dummy instance or throw error?
    // For now, we'll throw to catch usage
    throw new Error(
      "ViberDataManager.createClient() is deprecated. Use server actions."
    );
  }

  // ==================== Cache Management ====================

  private getCacheKey(prefix: string, id?: string): string {
    return id ? `${prefix}:${id}` : prefix;
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateCache(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  private notifySubscribers<T>(key: string, data: T): void {
    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (error) {
          console.error(
            `[ViberDataManager] Subscription callback error:`,
            error
          );
        }
      });
    }
  }

  // ==================== Space Operations ====================

  /**
   * Get a single space by ID
   */
  async getSpace(spaceId: string): Promise<DataSpace | null> {
    const cacheKey = this.getCacheKey("space", spaceId);
    const cached = this.getCached<DataSpace>(cacheKey);
    if (cached) return cached;

    const space = await this.dataAdapter.getSpace(spaceId);
    if (space) {
      this.setCache(cacheKey, space);
    }
    return space;
  }

  /**
   * List all spaces with optional filters
   */
  async listSpaces(filters?: SpaceFilters): Promise<DataSpace[]> {
    const cacheKey = `spaces:${JSON.stringify(filters || {})}`;
    const cached = this.getCached<DataSpace[]>(cacheKey);
    if (cached) return cached;

    let spaces = await this.dataAdapter.getSpaces();

    // Apply filters
    if (filters) {
      if (filters.userId) {
        spaces = spaces.filter((s) => s.userId === filters.userId);
      }
      if (filters.name) {
        const nameLower = filters.name.toLowerCase();
        spaces = spaces.filter((s) =>
          s.name?.toLowerCase().includes(nameLower)
        );
      }
      if (filters.createdAfter) {
        spaces = spaces.filter((s) => {
          if (!s.createdAt) return false;
          return new Date(s.createdAt) >= filters.createdAfter!;
        });
      }
      if (filters.createdBefore) {
        spaces = spaces.filter((s) => {
          if (!s.createdAt) return false;
          return new Date(s.createdAt) <= filters.createdBefore!;
        });
      }
    }

    this.setCache(cacheKey, spaces);
    return spaces;
  }

  /**
   * Create a new space
   */
  async createSpace(space: Partial<DataSpace>): Promise<DataSpace> {
    const newSpace = await this.dataAdapter.saveSpace({
      id: space.id || `space-${Date.now()}`,
      name: space.name || "New Space",
      description: space.description,
      userId: space.userId,
      config: space.config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as DataSpace);

    // Invalidate caches
    this.invalidateCache("spaces:");
    this.invalidateCache("space:");

    // Notify subscribers
    this.notifySubscribers("spaces", newSpace);
    this.notifySubscribers(`space:${newSpace.id}`, newSpace);

    return newSpace;
  }

  /**
   * Update a space
   */
  async updateSpace(
    spaceId: string,
    updates: Partial<DataSpace>
  ): Promise<DataSpace> {
    const existing = await this.getSpace(spaceId);
    if (!existing) {
      throw new Error(`Space ${spaceId} not found`);
    }

    const updated = await this.dataAdapter.saveSpace({
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    // Update cache
    this.setCache(this.getCacheKey("space", spaceId), updated);
    this.invalidateCache("spaces:");

    // Notify subscribers
    this.notifySubscribers(`space:${spaceId}`, updated);
    this.notifySubscribers("spaces", updated);

    return updated;
  }

  /**
   * Delete a space
   */
  async deleteSpace(spaceId: string): Promise<void> {
    await this.dataAdapter.deleteSpace(spaceId);

    // Invalidate caches
    this.invalidateCache("space:");
    this.invalidateCache("spaces:");
    this.invalidateCache(`artifacts:space:${spaceId}`);

    // Notify subscribers
    this.notifySubscribers(`space:${spaceId}`, null);
    this.notifySubscribers("spaces", null);
  }

  /**
   * Subscribe to space changes
   */
  subscribeToSpace(
    spaceId: string,
    callback: SubscriptionCallback<DataSpace | null>
  ): Unsubscribe {
    const key = `space:${spaceId}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    // Send current value immediately
    this.getSpace(spaceId).then((space) => callback(space));

    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    };
  }

  /**
   * Subscribe to all spaces
   */
  subscribeToSpaces(callback: SubscriptionCallback<DataSpace[]>): Unsubscribe {
    const key = "spaces";
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    // Send current value immediately
    this.listSpaces().then((spaces) => callback(spaces));

    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    };
  }

  // ==================== Artifact Operations ====================

  /**
   * Get artifacts for a space
   */
  async getArtifacts(
    spaceId: string,
    filters?: ArtifactFilters
  ): Promise<Artifact[]> {
    const cacheKey = `artifacts:space:${spaceId}:${JSON.stringify(
      filters || {}
    )}`;
    const cached = this.getCached<Artifact[]>(cacheKey);
    if (cached) return cached;

    let artifacts = await this.dataAdapter.getArtifacts(spaceId);

    // Apply filters
    if (filters) {
      if (filters.taskId) {
        artifacts = artifacts.filter((a) => a.taskId === filters.taskId);
      }
      if (filters.category) {
        artifacts = artifacts.filter((a) => a.category === filters.category);
      }
      if (filters.mimeType) {
        artifacts = artifacts.filter((a) => a.mimeType === filters.mimeType);
      }
    }

    this.setCache(cacheKey, artifacts);
    return artifacts;
  }

  /**
   * Get a single artifact by ID
   */
  async getArtifact(artifactId: string): Promise<Artifact | null> {
    const cacheKey = this.getCacheKey("artifact", artifactId);
    const cached = this.getCached<Artifact>(cacheKey);
    if (cached) return cached;

    const artifact = await this.dataAdapter.getArtifact(artifactId);
    if (artifact) {
      this.setCache(cacheKey, artifact);
    }
    return artifact;
  }

  /**
   * Create an artifact (metadata only - file upload handled separately)
   */
  async createArtifact(
    spaceId: string,
    artifact: Partial<Artifact>
  ): Promise<Artifact> {
    const newArtifact = await this.dataAdapter.saveArtifact({
      id: artifact.id || `artifact-${Date.now()}`,
      spaceId,
      userId: artifact.userId,
      taskId: artifact.taskId,
      category: artifact.category || "intermediate",
      storageKey: artifact.storageKey || "",
      originalName: artifact.originalName || "untitled",
      mimeType: artifact.mimeType || "application/octet-stream",
      sizeBytes: artifact.sizeBytes || 0,
      metadata: artifact.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Artifact);

    // Invalidate caches
    this.invalidateCache(`artifacts:space:${spaceId}`);
    this.setCache(this.getCacheKey("artifact", newArtifact.id), newArtifact);

    // Notify subscribers
    this.notifySubscribers(`artifacts:space:${spaceId}`, newArtifact);
    this.notifySubscribers(`artifact:${newArtifact.id}`, newArtifact);

    return newArtifact;
  }

  /**
   * Update an artifact
   */
  async updateArtifact(
    artifactId: string,
    updates: Partial<Artifact>
  ): Promise<Artifact> {
    const existing = await this.getArtifact(artifactId);
    if (!existing) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    const updated = await this.dataAdapter.saveArtifact({
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    // Update cache
    this.setCache(this.getCacheKey("artifact", artifactId), updated);
    if (existing.spaceId) {
      this.invalidateCache(`artifacts:space:${existing.spaceId}`);
    }

    // Notify subscribers
    this.notifySubscribers(`artifact:${artifactId}`, updated);
    if (existing.spaceId) {
      this.notifySubscribers(`artifacts:space:${existing.spaceId}`, updated);
    }

    return updated;
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(artifactId: string, spaceId: string): Promise<void> {
    await this.dataAdapter.deleteArtifact(artifactId);

    // Invalidate caches
    this.invalidateCache(`artifact:${artifactId}`);
    this.invalidateCache(`artifacts:space:${spaceId}`);

    // Notify subscribers
    this.notifySubscribers(`artifact:${artifactId}`, null);
    this.notifySubscribers(`artifacts:space:${spaceId}`, null);
  }

  /**
   * Subscribe to artifacts for a space
   */
  subscribeToArtifacts(
    spaceId: string,
    callback: SubscriptionCallback<Artifact[]>
  ): Unsubscribe {
    const key = `artifacts:space:${spaceId}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    // Send current value immediately
    this.getArtifacts(spaceId).then((artifacts) => callback(artifacts));

    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    };
  }

  // ==================== Task Operations ====================

  /**
   * Get tasks for a space
   */
  async getTasks(spaceId: string, filters?: TaskFilters): Promise<Task[]> {
    const cacheKey = `tasks:space:${spaceId}:${JSON.stringify(filters || {})}`;
    const cached = this.getCached<Task[]>(cacheKey);
    if (cached) return cached;

    let tasks = await this.dataAdapter.getTasks(spaceId);

    // Apply filters
    if (filters) {
      if (filters.status) {
        tasks = tasks.filter((t) => t.metadata?.status === filters.status);
      }
      if (filters.createdAfter) {
        tasks = tasks.filter((t) => {
          if (!t.createdAt) return false;
          return new Date(t.createdAt) >= filters.createdAfter!;
        });
      }
    }

    this.setCache(cacheKey, tasks);
    return tasks;
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    const cacheKey = this.getCacheKey("task", taskId);
    const cached = this.getCached<Task>(cacheKey);
    if (cached) return cached;

    const task = await this.dataAdapter.getTask(taskId);
    if (task) {
      this.setCache(cacheKey, task);
    }
    return task;
  }

  /**
   * Create a new task
   */
  async createTask(spaceId: string, task: Partial<Task>): Promise<Task> {
    const newTask = await this.dataAdapter.saveTask({
      id: task.id || `task-${Date.now()}`,
      spaceId,
      userId: task.userId,
      title: task.title,
      model: task.model,
      mode: task.mode || "chat",
      systemMessage: task.systemMessage,
      messages: task.messages || [],
      supervision: task.supervision,
      metadata: task.metadata,
      context: task.context,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Task);

    // Invalidate caches
    this.invalidateCache(`tasks:space:${spaceId}`);
    this.setCache(this.getCacheKey("task", newTask.id), newTask);

    // Notify subscribers
    this.notifySubscribers(`tasks:space:${spaceId}`, newTask);
    this.notifySubscribers(`task:${newTask.id}`, newTask);

    return newTask;
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const existing = await this.getTask(taskId);
    if (!existing) {
      throw new Error(`Task ${taskId} not found`);
    }

    const updated = await this.dataAdapter.saveTask({
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    // Update cache
    this.setCache(this.getCacheKey("task", taskId), updated);
    this.invalidateCache(`tasks:space:${existing.spaceId}`);

    // Notify subscribers
    this.notifySubscribers(`task:${taskId}`, updated);
    this.notifySubscribers(`tasks:space:${existing.spaceId}`, updated);

    return updated;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string, spaceId: string): Promise<void> {
    await this.dataAdapter.deleteTask(taskId);

    // Invalidate caches
    this.invalidateCache(`task:${taskId}`);
    this.invalidateCache(`tasks:space:${spaceId}`);

    // Notify subscribers
    this.notifySubscribers(`task:${taskId}`, null);
    this.notifySubscribers(`tasks:space:${spaceId}`, null);
  }

  /**
   * Subscribe to tasks for a space
   */
  subscribeToTasks(
    spaceId: string,
    callback: SubscriptionCallback<Task[]>
  ): Unsubscribe {
    const key = `tasks:space:${spaceId}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    // Send current value immediately
    this.getTasks(spaceId).then((tasks) => callback(tasks));

    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    };
  }

  // ==================== Agent Operations ====================

  /**
   * Get all agents
   */
  async getAgents(): Promise<Agent[]> {
    const cacheKey = "agents";
    const cached = this.getCached<Agent[]>(cacheKey);
    if (cached) return cached;

    const agents = await this.dataAdapter.getAgents();
    this.setCache(cacheKey, agents);
    return agents;
  }

  /**
   * Get a single agent by ID
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    const cacheKey = this.getCacheKey("agent", agentId);
    const cached = this.getCached<Agent>(cacheKey);
    if (cached) return cached;

    const agent = await this.dataAdapter.getAgent(agentId);
    if (agent) {
      this.setCache(cacheKey, agent);
    }
    return agent;
  }

  // ==================== Tool Operations ====================

  /**
   * Get all tools
   */
  async getTools(): Promise<Tool[]> {
    const cacheKey = "tools";
    const cached = this.getCached<Tool[]>(cacheKey);
    if (cached) return cached;

    const tools = await this.dataAdapter.getTools();
    this.setCache(cacheKey, tools);
    return tools;
  }

  /**
   * Get a single tool by ID
   */
  async getTool(toolId: string): Promise<Tool | null> {
    const cacheKey = this.getCacheKey("tool", toolId);
    const cached = this.getCached<Tool>(cacheKey);
    if (cached) return cached;

    const tool = await this.dataAdapter.getTool(toolId);
    if (tool) {
      this.setCache(cacheKey, tool);
    }
    return tool;
  }

  // ==================== Storage Operations ====================

  /**
   * Get SpaceStorage instance for a space
   */
  async getSpaceStorage(spaceId: string): Promise<SpaceStorageType> {
    return await SpaceStorageFactory.create(spaceId);
  }

  /**
   * Upload an artifact file
   */
  async uploadArtifactFile(
    spaceId: string,
    artifactId: string,
    file: File | Blob,
    filename: string
  ): Promise<string> {
    const storage = await this.getSpaceStorage(spaceId);
    const storageKey = `artifacts/${artifactId}/${filename}`;

    if (file instanceof Blob) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await storage.saveFileBuffer(storageKey, buffer);
    } else {
      await storage.saveFile(storageKey, file);
    }

    return storageKey;
  }

  /**
   * Download an artifact file
   */
  async downloadArtifactFile(
    spaceId: string,
    storageKey: string
  ): Promise<Blob> {
    const storage = await this.getSpaceStorage(spaceId);
    const buffer = await storage.readFile(storageKey);
    // Convert Buffer to Uint8Array for Blob (handles both ArrayBuffer and SharedArrayBuffer)
    const uint8Array = new Uint8Array(buffer);
    return new Blob([uint8Array]);
  }

  /**
   * Delete an artifact file
   */
  async deleteArtifactFile(spaceId: string, storageKey: string): Promise<void> {
    const storage = await this.getSpaceStorage(spaceId);
    await storage.delete(storageKey);
  }
}

// Export singleton instance getters
let clientInstance: ViberDataManager | null = null;
let serverInstance: ViberDataManager | null = null;

export function getViberDataManager(): ViberDataManager {
  if (typeof window === "undefined") {
    // Server-side
    if (!serverInstance) {
      serverInstance = ViberDataManager.createServerSync();
    }
    return serverInstance;
  } else {
    // Client-side - throw error to enforce server actions usage
    throw new Error(
      "getViberDataManager() cannot be called on the client. Use server actions."
    );
  }
}

/**
 * Get server-side ViberDataManager (for API routes and server components)
 * This uses direct database access, not API calls
 *
 * NOTE: This function can only be called from server-side code
 */
export function getViberDataManagerServer(): ViberDataManager {
  if (typeof window !== "undefined") {
    throw new Error(
      "getViberDataManagerServer() can only be called on the server"
    );
  }
  if (!serverInstance) {
    serverInstance = ViberDataManager.createServerSync();
  }
  return serverInstance;
}
