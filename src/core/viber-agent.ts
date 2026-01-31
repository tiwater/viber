/**
 * ViberAgent - The space's conversational representative
 *
 * X is the interface between users and their spaces. Each space has an X agent
 * that acts as its representative. When you need to interact with a space, you
 * talk to X. ViberAgent merges TaskExecutor and Orchestrator functionality into a
 * single, user-friendly interface.
 */

import { Agent, AgentContext, AgentResponse } from "./agent";
import { AgentConfig } from "./config";
import { Space } from "./space";
import { getServerDataAdapter } from "../data/factory";
import { Plan } from "./plan";
import { Task, TaskStatus } from "./task";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { ParallelTask } from "./collaboration";

export interface ViberOptions {
  model?: string; // AI model to use
  storageRoot?: string; // Storage location
  defaultGoal?: string; // Default goal for new spaces
  spaceId?: string; // Explicit space ID
  singleAgentId?: string; // If set, route directly to this agent ID
}

export interface ViberStreamOptions {
  messages?: any[]; // Message history
  tools?: any; // Tools available
  artifactId?: string; // Artifact context
  [key: string]: any; // Additional options
}

export interface ViberAgentResponse extends AgentResponse {
  plan?: Plan;
  taskResults?: any[];
  artifacts?: any[];
  preservedSteps?: string[];
  regeneratedSteps?: string[];
  planChanges?: Record<string, any>;
}

export class ViberAgent extends Agent {
  private space: Space;
  public readonly spaceId: string;
  private abortController?: AbortController;
  private singleAgentId?: string; // If set, bypass planning

  constructor(config: AgentConfig, space: Space, options?: ViberOptions) {
    // Enhance the config for ViberAgent
    const xConfig: AgentConfig = {
      ...config,
      name: "X",
      description: `I am X, the conversational representative for this space. I manage all aspects of the space and coordinate with other agents to achieve our goals.`,
    };

    super(xConfig);
    this.space = space;
    this.spaceId = space.spaceId;
    this.singleAgentId = options?.singleAgentId;
  }

  /**
   * Getter for space (needed for external access)
   */
  getSpace(): Space {
    return this.space;
  }

  /**
   * Override getSystemPrompt to include plan and artifacts context
   */
  public getSystemPrompt(context?: AgentContext): string {
    const basePrompt = super.getSystemPrompt(context);
    return basePrompt + this.getPlanContext() + this.getArtifactsContext();
  }

  /**
   * Generate text - uses new AI SDK-style signature
   */
  async generateText(options: {
    messages: any[];
    system?: string;
    [key: string]: any;
  }): Promise<any> {
    // Add space context to options
    return super.generateText({
      ...options,
      spaceId: this.space.spaceId,
      metadata: {
        spaceName: this.space.name,
        spaceGoal: this.space.goal,
        ...options.metadata,
      },
    });
  }

  /**
   * ViberAgent streamText - Orchestration Layer
   * Responsibilities: History management, agent delegation, persistence
   */
  async streamText(options: {
    messages: any[];
    system?: string;
    spaceId?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  }): Promise<any> {
    const {
      messages,
      system: systemMessage,
      spaceId,
      metadata = {},
      ...restOptions
    } = options;

    console.log("[ViberAgent] Orchestration layer: starting streamText");

    const mode = metadata?.mode;
    if (!mode || mode !== "agent") {
      throw new Error("ViberAgent only supports 'agent' mode");
    }

    // PHASE 1: History Management
    await this.updateSpaceHistory(messages, metadata);

    // PHASE 2: Agent Delegation
    const streamResult = await this.handleAgentMode(
      messages,
      systemMessage,
      spaceId,
      metadata,
      restOptions,
    );

    // PHASE 3: Message Persistence
    if (spaceId) {
      this.handleMessagePersistence(streamResult, messages, spaceId, metadata);
    }

    return streamResult;
  }

  /**
   * Agent Mode Handler - Direct delegation with performance optimization
   * Supports both single agent and parallel execution
   */
  private async handleAgentMode(
    messages: any[],
    systemMessage: string | undefined,
    spaceId: string | undefined,
    metadata: Record<string, any>,
    restOptions: any,
  ): Promise<any> {
    // Check if parallel execution is requested
    const parallelAgents = metadata.parallelAgents as string[] | undefined;
    if (parallelAgents && parallelAgents.length > 1) {
      return this.handleParallelExecution(
        parallelAgents,
        messages,
        systemMessage,
        spaceId,
        metadata,
        restOptions,
      );
    }

    // Single agent execution (existing logic)
    const targetAgent = metadata.requestedAgent;
    if (!targetAgent) {
      throw new Error("Agent mode requires requestedAgent in metadata");
    }

    console.log(
      `[ViberAgent] Agent mode: direct delegation to '${targetAgent}'`,
    );

    // Get or load target agent
    let agent = this.space.getAgent(targetAgent);
    if (!agent) {
      // Load agent on demand
      console.log(`[ViberAgent] Loading agent '${targetAgent}' on demand`);
      const dataAdapter = getServerDataAdapter();
      const agentConfig = await dataAdapter.getAgent(targetAgent);
      if (!agentConfig) {
        throw new Error(`Agent '${targetAgent}' not found`);
      }
      agent = new Agent(agentConfig as AgentConfig);
      this.space.registerAgent(targetAgent, agent);
    }

    // Use full conversation history so the LLM has context (e.g. user "1" after assistant's numbered list)
    const taskId = metadata?.taskId || metadata?.conversationId || "default";
    const task = this.space.getOrCreateTask(taskId);
    const fullHistory = task.history.getMessages();
    const messagesForAgent =
      fullHistory.length > 0
        ? this.optimizeContextForAgent(fullHistory)
        : this.optimizeContextForAgent(messages);
    console.log(
      `[ViberAgent] Agent mode: using ${messagesForAgent.length} messages from history`,
    );

    // Direct delegation - no orchestration overhead
    return await agent.streamText({
      messages: messagesForAgent,
      system: systemMessage,
      spaceId,
      metadata: {
        ...metadata,
        delegationType: "direct",
        userId: this.space.userId, // Pass space owner ID for tracking
      },
      ...restOptions,
    });
  }

  /**
   * Handle parallel execution of multiple agents
   */
  private async handleParallelExecution(
    agentIds: string[],
    messages: any[],
    systemMessage: string | undefined,
    spaceId: string | undefined,
    metadata: Record<string, any>,
    restOptions: any,
  ): Promise<any> {
    console.log(`[ViberAgent] Parallel execution: ${agentIds.length} agents`);

    // Ensure all agents are loaded
    const dataAdapter = getServerDataAdapter();
    for (const agentId of agentIds) {
      if (!this.space.getAgent(agentId)) {
        const agentConfig = await dataAdapter.getAgent(agentId);
        if (!agentConfig) {
          throw new Error(`Agent '${agentId}' not found`);
        }
        const agent = new Agent(agentConfig as AgentConfig);
        this.space.registerAgent(agentId, agent);
      }
    }

    // Use parallel execution engine
    if (!this.space.parallelEngine) {
      throw new Error("Parallel execution engine not initialized");
    }

    // ParallelTask type is imported at top of file
    const tasks = agentIds.map((agentId, index) => ({
      id: `parallel-${agentId}-${Date.now()}-${index}`,
      agentId,
      messages: this.optimizeContextForAgent(messages),
      system: systemMessage,
      metadata: {
        ...metadata,
        delegationType: "parallel",
        userId: this.space.userId,
        parallelIndex: index,
      },
      priority: agentIds.length - index, // First agent gets highest priority
    }));

    const results = await this.space.parallelEngine.executeParallel(tasks);

    // Aggregate results
    return {
      text: results.map((r) => `[${r.agentId}]: ${r.result.text}`).join("\n\n"),
      toolCalls: results.flatMap((r) => r.result.toolCalls || []),
      metadata: {
        ...metadata,
        parallelResults: results,
        agentCount: agentIds.length,
      },
    };
  }

  /**
   * Update space history with new messages
   * Now supports per-task history
   */
  private async updateSpaceHistory(
    messages: any[],
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Get taskId from metadata, or use "default" for legacy support
    const taskId = metadata?.taskId || metadata?.conversationId || "default";
    const task = this.space.getOrCreateTask(taskId);

    const existingMessages = task.history.getMessages();
    // When client sends only the new message(s), messages.length <= existingMessages.length:
    // append incoming messages. When client sends full thread, take only the new tail.
    const newMessages =
      messages.length > existingMessages.length
        ? messages.slice(existingMessages.length)
        : messages;

    if (newMessages.length > 0) {
      for (const msg of newMessages) {
        const formattedMsg = {
          ...msg,
          content:
            typeof msg.content === "string"
              ? msg.content
              : Array.isArray(msg.content)
                ? msg.content
                : [{ type: "text", text: msg.content }],
        };
        task.history.add(formattedMsg);
      }
      console.log(
        `[ViberAgent] Updated task ${taskId} history with ${newMessages.length} new messages`,
      );
    }
  }

  /**
   * Optimize message context for single-agent performance
   */
  private optimizeContextForAgent(messages: any[]): any[] {
    // For agent mode, use recent messages only to minimize token usage
    return messages.slice(-4); // Last 4 messages (2 exchanges)
  }

  /**
   * Extract user prompt from messages for orchestration
   */
  private extractPromptFromMessages(messages: any[]): string {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user") {
      const content = lastMessage.content;
      if (typeof content === "string") {
        return content;
      } else if (Array.isArray(content)) {
        return content
          .filter((part) => part.type === "text" && part.text)
          .map((part) => part.text)
          .join(" ");
      }
    }
    return "";
  }

  /**
   * Handle message persistence after streaming completes
   */
  private handleMessagePersistence(
    streamResult: any,
    messages: any[],
    spaceId: string,
    metadata: any,
  ) {
    (async () => {
      try {
        let finalText = "";
        const toolInvocations: any[] = [];

        for await (const part of streamResult.fullStream) {
          switch (part.type) {
            case "text-delta":
              if (part.text) {
                finalText += part.text;
              }
              break;
            case "tool-call":
              toolInvocations.push({
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args,
              });
              break;
            case "tool-result":
              const toolCall = toolInvocations.find(
                (t) => t.toolCallId === part.toolCallId,
              );
              if (toolCall) {
                toolCall.result = part.result;
              }
              break;
            case "finish":
              break;
            case "error":
              console.error("[ViberAgent] Stream error:", part.error);
              return;
          }
        }

        // Build assistant message in AI SDK v5 format
        const assistantMessage = {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: finalText }],
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          metadata: {
            agentName: this.singleAgentId || "team",
            spaceId,
            timestamp: Date.now(),
            ...metadata,
          },
          ...(toolInvocations.length > 0 && { toolInvocations }),
        };

        // Add assistant message to task history so next turn in same run has full context
        const taskId =
          metadata?.taskId || metadata?.conversationId || "default";
        const task = this.space.getOrCreateTask(taskId);
        task.history.add(assistantMessage);
        // Chat history is persisted at cockpit level, not by the viber agent
      } catch (error) {
        console.error("[ViberAgent] Failed to persist messages:", error);
      }
    })();
  }

  /**
   * Save space to storage
   */
  private async saveSpace(): Promise<void> {
    try {
      // NOTE: In database mode, space data is persisted through the data adapter (spaces table)
      // Storage is ONLY used for artifacts, not config files
      // This legacy file-based persistence is disabled to avoid conflicts

      // Legacy code disabled - space data now in database:
      // const { SpaceStorageFactory } = await import("../storage/space");
      // const storage = await SpaceStorageFactory.create(this.spaceId);
      // await storage.saveFile("space.json", { ... });

      // Space persistence is now handled by the API layer using SupabaseDatabaseAdapter
      // which writes to the spaces table, not storage buckets

      console.log("[ViberAgent] Space persistence handled by database adapter");
    } catch (error) {
      console.error("[ViberAgent] Error saving space:", error);
      // Don't throw - saving is best effort
    }
  }

  /**
   * Stop current operation
   */
  stop() {
    this.space.messageQueue.clear();
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Add message to queue (soft interrupt)
   */
  addMessage(message: string, metadata?: any) {
    return this.space.messageQueue.add(message, metadata);
  }

  /**
   * Enrich context with space information
   */
  private enrichContext(context?: Partial<AgentContext>): AgentContext {
    return {
      spaceId: this.space.spaceId,
      conversationHistory: this.space.history,
      metadata: {
        spaceName: this.space.name,
        spaceGoal: this.space.goal,
        ...context?.metadata,
      },
      ...context,
    };
  }

  /**
   * Create or update the space plan
   */
  async createPlan(goal?: string): Promise<Plan> {
    const planGoal = goal || this.space.goal;

    // Generate plan using LLM
    const planSchema = z.object({
      tasks: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          assignedTo: z.string().optional(),
          priority: z.enum(["low", "medium", "high"]).default("medium"),
          estimatedTime: z.string().optional(),
          dependencies: z
            .array(
              z.object({
                taskId: z.string(),
                type: z.enum(["required", "optional"]),
              }),
            )
            .default([]),
          tags: z.array(z.string()).default([]),
        }),
      ),
    });

    const result = await generateText({
      model: this.getModel(),
      system:
        this.getSystemPrompt() +
        "\n\nCreate a detailed plan to achieve the goal.",
      prompt: `Goal: ${planGoal}\n\nAvailable agents: ${Array.from(
        this.space.agents.keys(),
      ).join(", ")}`,
      output: Output.object({ schema: planSchema }),
    });

    // Create Plan with Tasks - cast result.output to inferred schema type
    const planData = result.output as z.infer<typeof planSchema>;
    const tasks = planData.tasks.map(
      (taskData: z.infer<typeof planSchema>["tasks"][number]) =>
        new Task({
          ...taskData,
          status: TaskStatus.PENDING,
        }),
    );

    const plan = new Plan({
      goal: planGoal,
      tasks,
    });

    await this.space.createPlan(plan);
    return plan;
  }

  /**
   * Adapt the plan based on new information or user feedback
   */
  async adaptPlan(feedback: string): Promise<Plan> {
    if (!this.space.plan) {
      // No existing plan, create a new one with the feedback
      return this.createPlan(feedback);
    }

    const currentPlan = this.space.plan;
    const progress = currentPlan.getProgressSummary();

    // Schema for plan adaptation
    const adaptSchema = z.object({
      preserveTasks: z
        .array(z.string())
        .describe("IDs of tasks to keep unchanged"),
      modifyTasks: z
        .array(
          z.object({
            id: z.string(),
            changes: z.object({
              title: z.string().optional(),
              description: z.string().optional(),
              priority: z.enum(["low", "medium", "high"]).optional(),
              assignedTo: z.string().optional(),
            }),
          }),
        )
        .describe("Tasks to modify"),
      removeTasks: z.array(z.string()).describe("IDs of tasks to remove"),
      addTasks: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
            assignedTo: z.string().optional(),
            priority: z.enum(["low", "medium", "high"]).default("medium"),
            dependencies: z
              .array(
                z.object({
                  taskId: z.string(),
                  type: z.enum(["required", "optional"]),
                }),
              )
              .default([]),
            tags: z.array(z.string()).default([]),
          }),
        )
        .describe("New tasks to add"),
      reasoning: z.string().describe("Explanation of the plan changes"),
    });

    const prompt = `
Current Plan Progress:
- Total tasks: ${progress.totalTasks}
- Completed: ${progress.completedTasks}
- In Progress: ${progress.runningTasks}
- Pending: ${progress.pendingTasks}

Current Tasks:
${currentPlan.tasks
  .map((t) => `- [${t.id}] ${t.title} (${t.status})`)
  .join("\n")}

User Feedback: ${feedback}

Analyze the current plan and adapt it based on the user's feedback.
Keep completed tasks unless explicitly asked to redo them.
Preserve tasks that are still relevant.
Modify, remove, or add tasks as needed to better achieve the goal.
`;

    const result = await generateText({
      model: this.getModel(),
      system:
        this.getSystemPrompt() +
        "\n\nAdapt the existing plan based on user feedback.",
      prompt,
      output: Output.object({ schema: adaptSchema }),
    });

    // Apply adaptations - cast result.output to inferred schema type
    const adaptData = result.output as z.infer<typeof adaptSchema>;
    const adaptedTasks: Task[] = [];

    // Keep preserved tasks
    for (const taskId of adaptData.preserveTasks) {
      const task = currentPlan.tasks.find((t) => t.id === taskId);
      if (task) {
        adaptedTasks.push(task);
      }
    }

    // Modify tasks
    for (const modification of adaptData.modifyTasks) {
      const task = currentPlan.tasks.find((t) => t.id === modification.id);
      if (task) {
        // Apply changes
        if (modification.changes.title) task.title = modification.changes.title;
        if (modification.changes.description)
          task.description = modification.changes.description;
        if (modification.changes.priority)
          task.priority = modification.changes.priority;
        if (modification.changes.assignedTo)
          task.assignedTo = modification.changes.assignedTo;
        adaptedTasks.push(task);
      }
    }

    // Add new tasks
    for (const newTaskData of adaptData.addTasks) {
      const newTask = new Task({
        ...newTaskData,
        status: TaskStatus.PENDING,
      });
      adaptedTasks.push(newTask);
    }

    // Create adapted plan
    const adaptedPlan = new Plan({
      goal: currentPlan.goal,
      tasks: adaptedTasks,
    });

    // Update space with adapted plan
    await this.space.createPlan(adaptedPlan);

    // Log the reasoning
    console.log("[Plan Adaptation]", adaptData.reasoning);

    return adaptedPlan;
  }

  /**
   * Get plan context for system prompt
   */
  private getPlanContext(): string {
    if (!this.space.plan) {
      return "\n\nNo active plan for this space yet.";
    }

    const summary = this.space.plan.getProgressSummary();
    return `

Current Plan Status:
- Total tasks: ${summary.totalTasks}
- Completed: ${summary.completedTasks}
- Running: ${summary.runningTasks}
- Pending: ${summary.pendingTasks}
- Failed: ${summary.failedTasks}
- Progress: ${summary.progressPercentage.toFixed(1)}%
`;
  }

  /**
   * Get artifacts context for system prompt
   */
  private getArtifactsContext(): string {
    if (!this.space.artifacts || this.space.artifacts.length === 0) {
      return "";
    }

    const artifactsList = this.space.artifacts
      .map((a) => `- ${a.title || a.path} (${a.artifactType || "document"})`)
      .join("\n");

    return `

Available Artifacts:
${artifactsList}

These artifacts are pre-loaded in the space and can be referenced in your responses.
`;
  }

  /**
   * Get ViberAgent summary
   */
  getSummary(): Record<string, any> {
    const base = super.getSummary();
    return {
      ...base,
      spaceId: this.space.spaceId,
      spaceName: this.space.name,
      spaceGoal: this.space.goal,
      planStatus: this.space.plan?.getProgressSummary(),
    };
  }

  /**
   * Static factory to start a new space
   */
  static async start(
    goal: string,
    options: ViberOptions = {},
  ): Promise<ViberAgent> {
    const { spaceId, model, singleAgentId } = options;

    // Use provided spaceId or generate one
    const id =
      spaceId ||
      `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start space (this creates ViberAgent internally)
    const { startSpace } = await import("./space");
    const space = await startSpace({
      spaceId: id,
      goal,
      name: goal.slice(0, 50),
      model,
    });

    if (!space.viberAgent) {
      throw new Error("Failed to initialize ViberAgent");
    }

    // Set singleAgentId if provided
    if (singleAgentId) {
      (space.viberAgent as any).singleAgentId = singleAgentId;
    }

    return space.viberAgent;
  }

  /**
   * Static factory to resume an existing space
   */
  static async resume(
    spaceId: string,
    options: ViberOptions = {},
  ): Promise<ViberAgent> {
    const { model } = options;

    // Load existing space
    const { SpaceStorageFactory } = await import("../storage/space");
    const { startSpace } = await import("./space");

    // Check if space exists
    const exists = await SpaceStorageFactory.exists(spaceId);
    if (!exists) {
      throw new Error(`Space ${spaceId} not found`);
    }

    // Load space data
    const storage = await SpaceStorageFactory.create(spaceId);
    const spaceData = await storage.readJSON<any>("space.json");

    if (!spaceData) {
      throw new Error(`Failed to load space ${spaceId}`);
    }

    // Recreate space with saved state
    const space = await startSpace({
      spaceId,
      goal: spaceData.goal,
      name: spaceData.name,
      model: model || spaceData.model,
    });

    if (!space.viberAgent) {
      throw new Error("Failed to initialize ViberAgent");
    }

    // Set singleAgentId if provided
    const agentId = options.singleAgentId || spaceData.singleAgentId;
    if (agentId) {
      (space.viberAgent as any).singleAgentId = agentId;
    }

    // Restore conversation messages if exists (e.g. CLI resume from local storage)
    const messages = await storage.readJSON<any[]>("messages.json");
    if (messages && Array.isArray(messages)) {
      space.history.clear();
      for (const msg of messages) {
        const normalizedMsg = { ...msg };
        if (typeof msg.content === "string") {
          normalizedMsg.content = [{ type: "text", text: msg.content }];
        }
        space.history.add(normalizedMsg);
      }
    }

    return space.viberAgent;
  }
}
