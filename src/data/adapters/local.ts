/**
 * LocalDataAdapter - File-based data storage using YAML/JSON files
 * Uses ~/.viber/ directory for local agent mode
 */

import type { DataAdapter } from "../adapter";
import type {
  Agent,
  Tool,
  Space,
  Artifact,
  Conversation,
  Task,
  ModelProvider,
  Datasource,
} from "../types";
import { SpaceStorageFactory } from "../../storage/space";
import { BaseStorage } from "../../storage/base";
import { getViberRoot } from "../../config";
import yaml from "yaml";
import path from "path";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LocalDataAdapter implements DataAdapter {
  // Helper to read and parse YAML file
  private async readYamlFile(storage: BaseStorage, path: string): Promise<any> {
    try {
      const content = await storage.readTextFile(path);
      return yaml.parse(content);
    } catch (error: any) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  // ==================== Agents ====================

  async getAgents(): Promise<Agent[]> {
    const defaultsStorage = new BaseStorage(
      path.join(__dirname, "..", "defaults")
    );
    const rootStorage = new BaseStorage(getViberRoot());
    const agents: Agent[] = [];

    // Load built-in agents from defaults/agents/
    try {
      const files = await defaultsStorage.list("agents");
      for (const file of files.filter(
        (f) => f.endsWith(".yaml") || f.endsWith(".yml")
      )) {
        const agent = await this.readYamlFile(
          defaultsStorage,
          `agents/${file}`
        );
        if (agent) {
          agents.push({ ...agent, isCustom: false });
        }
      }
    } catch {
      // No built-in agents
    }

    // Load user agents from ~/.viber/agents/
    try {
      const files = await rootStorage.list("agents");
      for (const file of files.filter(
        (f) => f.endsWith(".yaml") || f.endsWith(".yml")
      )) {
        const agent = await this.readYamlFile(rootStorage, `agents/${file}`);
        if (agent) {
          agents.push({ ...agent, isCustom: true });
        }
      }
    } catch {
      // No user agents
    }

    return agents;
  }

  async getAgent(id: string): Promise<Agent | null> {
    const defaultsPath = path.join(__dirname, "..", "defaults");
    const defaultsStorage = new BaseStorage(defaultsPath);
    const rootStorage = new BaseStorage(getViberRoot());

    // Try built-in first
    for (const ext of ["yaml", "yml"]) {
      const agent = await this.readYamlFile(
        defaultsStorage,
        `agents/${id}.${ext}`
      );
      if (agent) return { ...agent, id, isCustom: false };
    }

    // Try user agents
    for (const ext of ["yaml", "yml"]) {
      const agent = await this.readYamlFile(rootStorage, `agents/${id}.${ext}`);
      if (agent) return { ...agent, id, isCustom: true };
    }

    return null;
  }

  async saveAgent(agent: Agent): Promise<Agent> {
    const rootStorage = new BaseStorage(getViberRoot());
    const content = yaml.stringify(agent);
    await rootStorage.writeFile(`agents/${agent.id}.yaml`, content);
    return agent;
  }

  async deleteAgent(id: string): Promise<void> {
    const rootStorage = new BaseStorage(getViberRoot());
    try {
      await rootStorage.delete(`agents/${id}.yaml`);
    } catch {
      await rootStorage.delete(`agents/${id}.yml`);
    }
  }

  async cloneAgent(id: string): Promise<Agent> {
    const agent = await this.getAgent(id);
    if (!agent) throw new Error(`Agent ${id} not found`);

    const { generateShortId } = await import("../../utils/id");
    const newId = `custom-${generateShortId(8)}`;
    const cloned = { ...agent, id: newId, isCustom: true };

    return await this.saveAgent(cloned);
  }

  // ==================== Tools ====================

  async getTools(): Promise<Tool[]> {
    const defaultsStorage = new BaseStorage(
      path.join(__dirname, "..", "..", "defaults")
    );
    const tools: Tool[] = [];

    // Load built-in tools from defaults/tools/
    try {
      const files = await defaultsStorage.list("tools");
      for (const file of files.filter(
        (f) => f.endsWith(".yaml") || f.endsWith(".yml")
      )) {
        const tool = await this.readYamlFile(defaultsStorage, `tools/${file}`);
        if (tool) {
          tools.push(tool);
        }
      }
    } catch {
      // No tools
    }

    return tools;
  }

  async getTool(id: string): Promise<Tool | null> {
    const tools = await this.getTools();
    return tools.find((t) => t.id === id) || null;
  }

  async saveTool(tool: Tool): Promise<Tool> {
    const rootStorage = new BaseStorage(getViberRoot());
    await rootStorage.mkdir("tools");
    const content = yaml.stringify(tool);
    await rootStorage.writeFile(`tools/${tool.id}.yaml`, content);
    return tool;
  }

  async deleteTool(id: string): Promise<void> {
    const rootStorage = new BaseStorage(getViberRoot());
    try {
      await rootStorage.delete(`tools/${id}.yaml`);
    } catch {
      await rootStorage.delete(`tools/${id}.yml`);
    }
  }

  async cloneTool(id: string): Promise<Tool> {
    const tool = await this.getTool(id);
    if (!tool) throw new Error(`Tool ${id} not found`);

    const { generateShortId } = await import("../../utils/id");
    const newId = `custom-${generateShortId(8)}`;
    const cloned = { ...tool, id: newId };

    return await this.saveTool(cloned);
  }

  // ==================== Spaces ====================

  async getSpaces(): Promise<Space[]> {
    const spaceIds = await SpaceStorageFactory.list();
    const spaces: Space[] = [];

    for (const id of spaceIds) {
      const space = await this.getSpace(id);
      if (space) {
        spaces.push(space);
      }
    }

    return spaces;
  }

  async getSpace(id: string): Promise<Space | null> {
    try {
      const storage = await SpaceStorageFactory.create(id);
      const data = await storage.readJSON<any>("space.json");

      if (!data) return null;

      return {
        id,
        name: data.name || id,
        description: data.description,
        config: data.config || {},
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    } catch (error) {
      return null;
    }
  }

  async saveSpace(space: Space): Promise<Space> {
    const storage = await SpaceStorageFactory.create(space.id);

    const data = {
      name: space.name,
      description: space.description,
      config: space.config || {},
      createdAt: space.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.writeJSON("space.json", data);
    return space;
  }

  async deleteSpace(id: string): Promise<void> {
    // Space deletion needs to be handled carefully
    // For now, we just mark it as deleted or remove the directory
    throw new Error("Space deletion not implemented in local mode");
  }

  // ==================== Artifacts ====================

  async getArtifacts(spaceId: string): Promise<Artifact[]> {
    const storage = await SpaceStorageFactory.create(spaceId);
    const files = await storage.list("artifacts");
    const artifacts: Artifact[] = [];

    for (const file of files) {
      // Skip system files
      if (file.startsWith(".")) {
        continue;
      }

      // In local mode without DB, we can't easily get metadata
      // Just return basic file info
      try {
        const stats = await storage.getArtifactFileStats(`artifacts/${file}`);

        artifacts.push({
          id: file, // Storage key as ID
          spaceId,
          storageKey: file,
          originalName: file,
          mimeType: "application/octet-stream", // Unknown without metadata
          sizeBytes: stats.size,
          metadata: {},
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
        });
      } catch (error) {
        // Skip files we can't read
        continue;
      }
    }

    return artifacts;
  }

  async getArtifact(id: string): Promise<Artifact | null> {
    // In local mode, we need space context to find artifacts
    // This is a limitation of file-based storage
    throw new Error("getArtifact requires space context in local mode");
  }

  async saveArtifact(artifact: Artifact): Promise<Artifact> {
    // Artifacts are saved through SpaceStorage.saveArtifact()
    // This method is mainly for metadata updates
    // In local mode without DB, we can't persist metadata separately easily
    // So this is effectively a no-op for metadata persistence in pure local mode
    return artifact;
  }

  async deleteArtifact(id: string): Promise<void> {
    // Requires space context
    throw new Error("deleteArtifact requires space context in local mode");
  }

  // NEW: Artifact queries by ownership and category
  async getArtifactsBySpace(spaceId: string): Promise<Artifact[]> {
    const allArtifacts = await this.getArtifacts(spaceId);
    return allArtifacts.filter(
      (a) => a.spaceId === spaceId || (a.spaceId === spaceId && !a.taskId)
    );
  }

  async getArtifactsByTask(taskId: string): Promise<Artifact[]> {
    // In local mode, we need to iterate through spaces to find task artifacts
    // This is inefficient but necessary for file-based storage
    const spaceIds = await SpaceStorageFactory.list();
    const taskArtifacts: Artifact[] = [];

    for (const wsId of spaceIds) {
      const artifacts = await this.getArtifacts(wsId);
      taskArtifacts.push(...artifacts.filter((a) => a.taskId === taskId));
    }

    return taskArtifacts;
  }

  async getArtifactsByCategory(
    spaceOrTaskId: string,
    category: "input" | "intermediate" | "output",
    isTask = false
  ): Promise<Artifact[]> {
    const artifacts = isTask
      ? await this.getArtifactsByTask(spaceOrTaskId)
      : await this.getArtifactsBySpace(spaceOrTaskId);

    return artifacts.filter((a) => a.category === category);
  }

  // ==================== Tasks (formerly Conversations) ====================

  async getTasks(spaceId: string): Promise<Task[]> {
    const conversations = await this.getConversations(spaceId);
    // Task extends Conversation, so we can cast
    return conversations as Task[];
  }

  async getTask(id: string): Promise<Task | null> {
    const conversation = await this.getConversation(id);
    return conversation as Task | null;
  }

  async saveTask(task: Task): Promise<Task> {
    const conversation = await this.saveConversation(task as Conversation);
    return conversation as Task;
  }

  async deleteTask(id: string): Promise<void> {
    await this.deleteConversation(id);
  }

  // ==================== Conversations (Legacy) ====================

  async getConversations(spaceId: string): Promise<Conversation[]> {
    const storage = await SpaceStorageFactory.create(spaceId);

    try {
      // In local mode, we might store conversations as individual files
      // or as part of space.json
      const files = await storage.list("conversations");
      const conversations: Conversation[] = [];

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        try {
          const data = await storage.readJSON<Conversation>(
            `conversations/${file}`
          );
          if (data) {
            conversations.push(data);
          }
        } catch (error) {
          continue;
        }
      }

      return conversations;
    } catch (error) {
      // Conversations directory doesn't exist yet
      return [];
    }
  }

  async getConversation(id: string): Promise<Conversation | null> {
    // Requires space context
    throw new Error("getConversation requires space context in local mode");
  }

  async saveConversation(conversation: Conversation): Promise<Conversation> {
    if (!conversation.spaceId) {
      throw new Error("Conversation must have a spaceId");
    }
    const storage = await SpaceStorageFactory.create(conversation.spaceId);
    await storage.mkdir("conversations");
    await storage.writeJSON(
      `conversations/${conversation.id}.json`,
      conversation
    );
    return conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    // Requires space context
    throw new Error("deleteConversation requires space context in local mode");
  }

  // ==================== Model Providers ====================

  async getModelProviders(): Promise<ModelProvider[]> {
    try {
      const storage = new BaseStorage(getViberRoot());
      const content = await storage.readTextFile("models.yaml");
      const data = yaml.parse(content);
      return Object.entries(data || {}).map(([id, config]: [string, any]) => ({
        id,
        ...config,
      }));
    } catch (error: any) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async getModelProvider(id: string): Promise<ModelProvider | null> {
    const providers = await this.getModelProviders();
    return providers.find((p) => p.id === id) || null;
  }

  async saveModelProvider(provider: ModelProvider): Promise<ModelProvider> {
    const storage = new BaseStorage(getViberRoot());
    const providers = await this.getModelProviders();
    const existing = providers.find((p) => p.id === provider.id);

    let updated: ModelProvider[];
    if (existing) {
      updated = providers.map((p) => (p.id === provider.id ? provider : p));
    } else {
      updated = [...providers, provider];
    }

    // Convert array to object for YAML format
    const data = updated.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    const content = yaml.stringify(data);
    await storage.writeFile("models.yaml", content);
    return provider;
  }

  async deleteModelProvider(id: string): Promise<void> {
    const storage = new BaseStorage(getViberRoot());
    const providers = await this.getModelProviders();
    const filtered = providers.filter((p) => p.id !== id);
    const data = filtered.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    const content = yaml.stringify(data);
    await storage.writeFile("models.yaml", content);
  }

  // ==================== Datasources ====================

  async getDatasources(): Promise<Datasource[]> {
    try {
      const storage = new BaseStorage(getViberRoot());
      const content = await storage.readTextFile("datasources.yaml");
      const data = yaml.parse(content);
      return Object.entries(data || {}).map(([id, config]: [string, any]) => ({
        id,
        ...config,
      }));
    } catch (error: any) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async getDatasource(id: string): Promise<Datasource | null> {
    const datasources = await this.getDatasources();
    return datasources.find((d) => d.id === id) || null;
  }

  async saveDatasource(datasource: Datasource): Promise<Datasource> {
    const storage = new BaseStorage(getViberRoot());
    const datasources = await this.getDatasources();
    const existing = datasources.find((d) => d.id === datasource.id);

    let updated: Datasource[];
    if (existing) {
      updated = datasources.map((d) =>
        d.id === datasource.id ? datasource : d
      );
    } else {
      updated = [...datasources, datasource];
    }

    const data = updated.reduce((acc, d) => ({ ...acc, [d.id]: d }), {});
    const content = yaml.stringify(data);
    await storage.writeFile("datasources.yaml", content);
    return datasource;
  }

  async deleteDatasource(id: string): Promise<void> {
    const storage = new BaseStorage(getViberRoot());
    const datasources = await this.getDatasources();
    const filtered = datasources.filter((d) => d.id !== id);
    const data = filtered.reduce((acc, d) => ({ ...acc, [d.id]: d }), {});
    const content = yaml.stringify(data);
    await storage.writeFile("datasources.yaml", content);
  }
}
