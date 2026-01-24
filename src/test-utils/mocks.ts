import { vi } from "vitest";
import type { DataAdapter } from "../data/adapter";
import type {
  Agent,
  Tool,
  Space,
  Artifact,
  Conversation,
  Task,
  ModelProvider,
  Datasource,
} from "../data/types";

export class MockDataAdapter implements DataAdapter {
  agents = new Map<string, Agent>();
  tools = new Map<string, Tool>();
  spaces = new Map<string, Space>();
  artifacts = new Map<string, Artifact>();
  tasks = new Map<string, Task>();
  modelProviders = new Map<string, ModelProvider>();
  datasources = new Map<string, Datasource>();

  constructor() {}

  // Agents
  async getAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }
  async getAgent(id: string): Promise<Agent | null> {
    return this.agents.get(id) || null;
  }
  async saveAgent(agent: Agent): Promise<Agent> {
    this.agents.set(agent.id, agent);
    return agent;
  }
  async deleteAgent(id: string): Promise<void> {
    this.agents.delete(id);
  }
  async cloneAgent(id: string): Promise<Agent> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);
    const newAgent = { ...agent, id: `copy-${id}` };
    this.agents.set(newAgent.id, newAgent);
    return newAgent;
  }

  // Tools
  async getTools(): Promise<Tool[]> {
    return Array.from(this.tools.values());
  }
  async getTool(id: string): Promise<Tool | null> {
    return this.tools.get(id) || null;
  }
  async saveTool(tool: Tool): Promise<Tool> {
    this.tools.set(tool.id, tool);
    return tool;
  }
  async deleteTool(id: string): Promise<void> {
    this.tools.delete(id);
  }
  async cloneTool(id: string): Promise<Tool> {
    const tool = this.tools.get(id);
    if (!tool) throw new Error(`Tool ${id} not found`);
    const newTool = { ...tool, id: `copy-${id}` };
    this.tools.set(newTool.id, newTool);
    return newTool;
  }

  // Spaces
  async getSpaces(): Promise<Space[]> {
    return Array.from(this.spaces.values());
  }
  async getSpace(id: string): Promise<Space | null> {
    return this.spaces.get(id) || null;
  }
  async saveSpace(space: Space): Promise<Space> {
    this.spaces.set(space.id, space);
    return space;
  }
  async deleteSpace(id: string): Promise<void> {
    this.spaces.delete(id);
  }

  // Artifacts
  async getArtifacts(spaceId: string): Promise<Artifact[]> {
    return Array.from(this.artifacts.values()).filter(
      (a) => a.spaceId === spaceId
    );
  }
  async getArtifact(id: string): Promise<Artifact | null> {
    return this.artifacts.get(id) || null;
  }
  async saveArtifact(artifact: Artifact): Promise<Artifact> {
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }
  async deleteArtifact(id: string): Promise<void> {
    this.artifacts.delete(id);
  }

  // Artifact queries
  async getArtifactsBySpace(spaceId: string): Promise<Artifact[]> {
    return this.getArtifacts(spaceId);
  }
  async getArtifactsByTask(taskId: string): Promise<Artifact[]> {
    return Array.from(this.artifacts.values()).filter(
      (a) => a.taskId === taskId
    );
  }
  async getArtifactsByCategory(
    spaceOrTaskId: string,
    category: "input" | "intermediate" | "output",
    isTask: boolean = false
  ): Promise<Artifact[]> {
    const all = isTask
      ? await this.getArtifactsByTask(spaceOrTaskId)
      : await this.getArtifactsBySpace(spaceOrTaskId);
    return all.filter((a) => a.category === category);
  }

  // Tasks
  async getTasks(spaceId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((t) => t.spaceId === spaceId);
  }
  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }
  async saveTask(task: Task): Promise<Task> {
    this.tasks.set(task.id, task);
    return task;
  }
  async deleteTask(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  // Legacy Conversations
  async getConversations(spaceId: string): Promise<Conversation[]> {
    return this.getTasks(spaceId);
  }
  async getConversation(id: string): Promise<Conversation | null> {
    return this.getTask(id);
  }
  async saveConversation(conversation: Conversation): Promise<Conversation> {
    return this.saveTask(conversation as Task);
  }
  async deleteConversation(id: string): Promise<void> {
    return this.deleteTask(id);
  }

  // Model Providers
  async getModelProviders(): Promise<ModelProvider[]> {
    return Array.from(this.modelProviders.values());
  }
  async getModelProvider(id: string): Promise<ModelProvider | null> {
    return this.modelProviders.get(id) || null;
  }
  async saveModelProvider(provider: ModelProvider): Promise<ModelProvider> {
    this.modelProviders.set(provider.id, provider);
    return provider;
  }
  async deleteModelProvider(id: string): Promise<void> {
    this.modelProviders.delete(id);
  }

  // Datasources
  async getDatasources(): Promise<Datasource[]> {
    return Array.from(this.datasources.values());
  }
  async getDatasource(id: string): Promise<Datasource | null> {
    return this.datasources.get(id) || null;
  }
  async saveDatasource(datasource: Datasource): Promise<Datasource> {
    this.datasources.set(datasource.id, datasource);
    return datasource;
  }
  async deleteDatasource(id: string): Promise<void> {
    this.datasources.delete(id);
  }
}

export const createMockAIProvider = () => {
  return {
    streamText: vi.fn(() => ({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Mocked response" };
        yield { type: "finish", finishReason: "stop" };
      })(),
      textStream: (async function* () {
        yield "Mocked response";
      })(),
      text: "Mocked response",
      agentMetadata: { name: "test-agent" },
    })),
    generateText: vi.fn(() =>
      Promise.resolve({
        text: "Mocked generated text",
        toolCalls: [],
      })
    ),
  };
};
