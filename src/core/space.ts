/**
 * Space - The top-level container for Viber work (formerly Space)
 *
 * A Space represents a project context that contains multiple tasks.
 * Each space is managed by an XAgent that serves as its orchestrator.
 *
 * Key concepts:
 * - Space: Project container with shared configuration
 * - Task: Individual conversation threads within a space
 * - Each task has its own conversation history and artifacts
 */

import { Plan } from "./plan";
import { Task, TaskStatus } from "./task";
import { ViberAgent, ViberOptions } from "./viber-agent";
import { SpaceStorage, SpaceStorageFactory } from "../storage/space";
import { SpaceConfig, AgentConfig } from "./config";
import { Agent } from "./agent";
import { MessageQueue, ConversationHistory } from "./message";
import type { SpaceModel, SpaceState } from "../types";
import {
  AgentCollaborationManager,
  ParallelExecutionEngine,
  CollaborativePlanner,
} from "./collaboration";

// Re-export for convenience
export type { SpaceModel, SpaceState };

// Task within a space
export interface SpaceTask {
  id: string;
  spaceId: string;
  title: string;
  history: ConversationHistory;
  artifactIds: string[];
  status: "active" | "completed" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

export class Space {
  public spaceId: string;
  public userId?: string; // User ID of space owner
  public config: SpaceConfig;
  public history: ConversationHistory; // Legacy: primary task history
  public tasks: Map<string, SpaceTask>; // NEW: Multiple tasks
  public messageQueue: MessageQueue;
  public agents: Map<string, Agent>;
  public storage: SpaceStorage;
  public goal: string;
  public name: string;
  public viberAgent?: ViberAgent;
  public createdAt: Date;
  public updatedAt: Date;
  public plan?: Plan;
  public artifacts?: any[];
  public collaborationManager?: AgentCollaborationManager;
  public parallelEngine?: ParallelExecutionEngine;
  public collaborativePlanner?: CollaborativePlanner;

  constructor({
    spaceId,
    userId,
    config,
    history,
    messageQueue,
    agents,
    storage,
    goal,
    name,
    viberAgent,
  }: {
    spaceId: string;
    userId?: string;
    config: SpaceConfig;
    history: ConversationHistory;
    messageQueue: MessageQueue;
    agents: Map<string, Agent>;
    storage: SpaceStorage;
    goal: string;
    name?: string;
    viberAgent?: ViberAgent;
  }) {
    this.spaceId = spaceId;
    this.userId = userId;
    this.config = config;
    this.history = history; // Legacy: default task history
    this.tasks = new Map(); // NEW: Task storage
    this.messageQueue = messageQueue;
    this.agents = agents;
    this.storage = storage;
    this.goal = goal;
    this.name = name || `Space ${spaceId}`;
    this.viberAgent = viberAgent;
    this.createdAt = new Date();
    this.updatedAt = new Date();

    // Initialize collaboration components
    this.collaborationManager = new AgentCollaborationManager(this);
    this.parallelEngine = new ParallelExecutionEngine(this);
    this.collaborativePlanner = new CollaborativePlanner(
      this,
      this.collaborationManager,
    );
  }

  /**
   * Get or create a task within this space
   */
  getOrCreateTask(taskId: string, title?: string): SpaceTask {
    if (!this.tasks.has(taskId)) {
      const task: SpaceTask = {
        id: taskId,
        spaceId: this.spaceId,
        title: title || `Task ${taskId}`,
        history: new ConversationHistory(),
        artifactIds: [],
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.tasks.set(taskId, task);
      console.log(`[Space] Created task ${taskId} in space ${this.spaceId}`);
    }
    return this.tasks.get(taskId)!;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): SpaceTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks in this space
   */
  getAllTasks(): SpaceTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Update space task status (for conversation tasks, not Plan tasks)
   */
  updateSpaceTaskStatus(
    taskId: string,
    status: "active" | "completed" | "archived",
  ): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      return true;
    }
    return false;
  }

  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  registerAgent(name: string, agent: Agent): void {
    this.agents.set(name, agent);
    console.log(`[Space] Registered agent: ${name} - ${agent.description}`);
  }

  complete(): void {
    console.log(`Space ${this.spaceId} completed`);
  }

  getContext(): Record<string, any> {
    const context: Record<string, any> = {
      spaceId: this.spaceId,
      goal: this.goal,
      storagePath: this.storage.getSpacePath(),
      agents: Array.from(this.agents.keys()),
      historyLength: this.history.messages.length,
      createdAt: this.createdAt.toISOString(),
    };

    if (this.plan) {
      context.plan = {
        goal: this.goal,
        totalTasks: this.plan.tasks.length,
        progress: this.plan.getProgressSummary(),
      };
    }

    return context;
  }

  async createPlan(plan: Plan): Promise<void> {
    this.plan = plan;
    await this.persistState();
    console.log(
      `Created plan for space ${this.spaceId} with ${plan.tasks.length} tasks`,
    );
  }

  async updatePlan(plan: Plan): Promise<void> {
    this.plan = plan;
    this.updatedAt = new Date();
    await this.persistState();
    console.log(`Updated plan for space ${this.spaceId}`);
  }

  async setName(name: string): Promise<void> {
    this.name = name;
    this.updatedAt = new Date();
    await this.persistState();
    console.log(`Updated space ${this.spaceId} name to: ${name}`);
  }

  async getNextTask(): Promise<Task | undefined> {
    if (!this.plan) {
      return undefined;
    }
    return this.plan.getNextActionableTask();
  }

  async getParallelTasks(maxTasks: number = 3): Promise<Task[]> {
    if (!this.plan) {
      return [];
    }
    return this.plan.getAllActionableTasks(maxTasks);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<boolean> {
    if (!this.plan) {
      return false;
    }

    const success = this.plan.updateTaskStatus(taskId, status);
    if (success) {
      this.updatedAt = new Date();
      await this.persistState();
      console.log(`Updated task ${taskId} status to ${status}`);
    }

    return success;
  }

  async assignTask(taskId: string, agentName: string): Promise<boolean> {
    if (!this.plan) {
      return false;
    }

    const task = this.plan.getTaskById(taskId);
    if (!task) {
      return false;
    }

    if (!this.agents.has(agentName)) {
      console.error(`Agent '${agentName}' not found in space team`);
      return false;
    }

    task.assignedTo = agentName;
    this.updatedAt = new Date();
    await this.persistState();
    console.log(`Assigned task ${taskId} to agent ${agentName}`);
    return true;
  }

  isPlanComplete(): boolean {
    if (!this.plan) {
      return false;
    }
    return this.plan.isComplete();
  }

  hasFailedTasks(): boolean {
    if (!this.plan) {
      return false;
    }
    return this.plan.hasFailedTasks();
  }

  async persistState(): Promise<void> {
    // NOTE: In database mode, space data is persisted through the data adapter (spaces table)
    // Storage is ONLY used for artifacts, not config files
    // This legacy file-based persistence is disabled to avoid conflicts
    // Space persistence is now handled by the API layer using SupabaseDatabaseAdapter
    console.log("[Space] State persistence handled by database adapter");
  }

  async loadState(): Promise<boolean> {
    try {
      // NOTE: In database mode, space data is loaded from the database, not storage
      // This method is kept for backward compatibility but returns false
      console.log("[Space] State loading handled by database adapter");
      return false;

      // Legacy code disabled:
      // const spaceData = await this.storage.readFile("space.json");
      // if (spaceData) {
      //   const data = JSON.parse(spaceData.toString("utf-8")) as SpaceModel;
      //   this.createdAt = new Date(data.createdAt || this.createdAt.toISOString());
      //   this.updatedAt = new Date(data.updatedAt || this.updatedAt.toISOString());
      //   this.name = data.name || this.name;
      //   if (data.plan) {
      //     this.plan = Plan.fromJSON(data.plan);
      //   }
      //   // Load artifacts...
      //   return true;
      // }
    } catch (error) {
      console.error("Failed to load space state:", error);
    }
    return false;
  }

  async loadPlan(): Promise<Plan | undefined> {
    if (await this.loadState()) {
      return this.plan;
    }
    return undefined;
  }

  getState(): SpaceState {
    const state: SpaceState = {
      spaceId: this.spaceId,
      name: this.name,
      goal: this.goal,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      teamSize: this.agents.size,
    };

    if (this.plan) {
      const taskStats = {
        total: this.plan.tasks.length,
        completed: this.plan.tasks.filter(
          (t) => t.status === TaskStatus.COMPLETED,
        ).length,
        running: this.plan.tasks.filter((t) => t.status === TaskStatus.RUNNING)
          .length,
        pending: this.plan.tasks.filter((t) => t.status === TaskStatus.PENDING)
          .length,
        failed: this.plan.tasks.filter((t) => t.status === TaskStatus.FAILED)
          .length,
      };
      state.tasks = taskStats;
      state.progressPercentage =
        taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0;
    }

    return state;
  }
}

/**
 * Start a new space
 */
export async function startSpace({
  goal,
  spaceId,
  userId,
  spaceRoot,
  name,
  model,
}: {
  goal: string;
  spaceId?: string;
  userId?: string;
  spaceRoot?: string;
  name?: string;
  model?: string;
}): Promise<Space> {
  const id = spaceId || `proj_${Date.now().toString(36)}`;

  // Create minimal space config
  const spaceConfig: SpaceConfig = {
    name: name || goal.slice(0, 50),
    autoSave: true,
    checkpointInterval: 300,
  };

  console.log(`[Space] Creating space - agents will be loaded on demand`);

  // Create storage
  const storage = await SpaceStorageFactory.create(id);

  // Create agents map - empty initially, agents loaded on demand
  const agents = new Map<string, Agent>();

  console.log(`[Space] Space initialized (agents loaded on demand)`);

  // Create message queue and history
  const messageQueue = new MessageQueue();
  const history = new ConversationHistory();

  // Create the space
  const space = new Space({
    spaceId: id,
    userId,
    config: spaceConfig,
    history,
    messageQueue,
    agents,
    storage,
    goal,
    name: name || spaceConfig.name,
  });

  // Create ViberAgent for the space
  const viberAgentConfig: AgentConfig = {
    name: "Viber",
    description: "I manage this space and coordinate all work.",
    provider: "openrouter",
    model: model || "deepseek/deepseek-chat",
    temperature: 0.7,
    promptFile: "", // ViberAgent doesn't use prompt files
  };

  const viberAgent = new ViberAgent(viberAgentConfig, space, {
    model,
    spaceId: id,
  });
  space.viberAgent = viberAgent;

  // MCP tools are now loaded on-demand by agents, not pre-loaded
  // This avoids the need for a central tool registry

  // Save initial state
  await space.persistState();

  return space;
}
