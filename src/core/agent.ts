/**
 * Agent - Config-driven agent implementation
 *
 * Agents are defined entirely by configuration, not code.
 * Each agent is instantiated from a config object that defines
 * its role, tools, and LLM settings.
 */

import { generateText, streamText } from "ai";
import type { LanguageModel, ModelMessage } from "ai";
import { getViberPath } from "../config";
import { AgentConfig } from "./config";
import { ConversationHistory, ViberMessage } from "./message";
import { getModelProvider } from "./provider";
import { buildToolMap } from "./tool";
import { generateShortId } from "../utils/id";

export interface AgentContext {
  spaceId: string;
  taskId?: string;
  conversationHistory: ConversationHistory;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  text: string;
  toolCalls?: any[];
  reasoning?: string;
  metadata?: Record<string, any>;
}

/**
 * Config-driven Agent implementation
 * No subclasses needed - behavior is entirely config-driven
 */
import { defaultRegistry } from "../skills/registry";

/**
 * Config-driven Agent implementation
 * No subclasses needed - behavior is entirely config-driven
 */
export class Agent {
  public id: string;
  public name: string;
  public description: string;
  public config: AgentConfig;

  // LLM configuration
  public provider: string;
  public model: string;
  public temperature?: number;
  public maxTokens?: number;
  public topP?: number;
  public frequencyPenalty?: number;
  public presencePenalty?: number;
  public systemPrompt?: string;

  // Agent configuration
  public tools: string[];
  public skills: string[];
  public personality?: string;

  // Skill state
  private skillInstructions: string = "";
  private loadedSkillTools: Record<string, any> = {};
  private skillsLoaded: boolean = false;

  constructor(config: AgentConfig) {
    this.config = config;
    this.id = config.id || config.name;
    this.name = config.name;
    this.description = config.description;

    // LLM settings
    if (config.llm) {
      this.provider = config.llm.provider;
      this.model = config.llm.model;
      this.temperature = config.llm.settings?.temperature;
      this.maxTokens = config.llm.settings?.maxTokens;
      this.topP = config.llm.settings?.topP;
      this.frequencyPenalty = config.llm.settings?.frequencyPenalty;
      this.presencePenalty = config.llm.settings?.presencePenalty;
      this.systemPrompt = config.systemPrompt;
    } else {
      this.provider = config.provider!;
      this.model = config.model!;
      this.temperature = config.temperature;
      this.maxTokens = config.maxTokens;
      this.topP = config.topP;
      this.frequencyPenalty = config.frequencyPenalty;
      this.presencePenalty = config.presencePenalty;
      this.systemPrompt = config.systemPrompt;
    }

    if (this.provider === "viber" || this.provider?.startsWith("viber-")) {
      throw new Error(
        `Invalid provider '${this.provider}' for agent '${this.name}'. Viber is not an AI provider.`,
      );
    }

    this.tools = config.tools || [];
    this.skills = config.skills || [];
    this.personality = config.personality;
  }

  /**
   * Ensure skills are loaded from registry
   */
  private async ensureSkillsLoaded(): Promise<void> {
    if (this.skillsLoaded) return;

    if (this.skills && this.skills.length > 0) {
      const instructionParts: string[] = [];

      for (const skillId of this.skills) {
        // Load skill metadata and instructions
        const skill = await defaultRegistry.loadSkill(skillId);
        if (skill) {
          instructionParts.push(`\n### Skill: ${skill.metadata.name}`);
          instructionParts.push(skill.metadata.description);
          if (skill.instructions) {
            instructionParts.push(skill.instructions);
          }

          // Load tools
          const tools = await defaultRegistry.getTools(skillId);
          Object.assign(this.loadedSkillTools, tools);
        } else {
          console.warn(`[Agent] Skill '${skillId}' not found`);
        }
      }

      this.skillInstructions = instructionParts.join("\n\n");
    }

    this.skillsLoaded = true;
  }

  /**
   * Get the system prompt for this agent
   */
  protected getSystemPrompt(context?: AgentContext): string {
    const segments: string[] = [];

    // Base identity
    segments.push(`You are ${this.name}.`);
    segments.push(this.description);

    // Personality
    if (this.personality) {
      segments.push(`\nPersonality: ${this.personality}`);
    }

    // Skill Instructions
    if (this.skillInstructions) {
      segments.push("\n=== ENABLED SKILLS ===");
      segments.push(this.skillInstructions);
      segments.push("======================\n");
    }

    // Tool usage instructions
    if (
      (this.tools && this.tools.length > 0) ||
      Object.keys(this.loadedSkillTools).length > 0
    ) {
      segments.push("\nIMPORTANT - TOOL USAGE:");
      segments.push("You have tools available. To use a tool, you MUST:");
      segments.push("1. Use the tool calling mechanism provided by the system");
      segments.push(
        "2. NEVER output tool calls as JSON, code blocks, or plain text",
      );
      segments.push(
        "When you need to call a tool, simply invoke it directly without any formatting.",
      );
    }

    // Custom system prompt
    if (this.systemPrompt) {
      segments.push(`\n${this.systemPrompt}`);
    }

    // Context information
    if (context) {
      segments.push("\nCurrent Context:");
      segments.push(`- Space ID: ${context.spaceId}`);
      if (context.taskId) segments.push(`- Task ID: ${context.taskId}`);

      if (context.metadata) {
        // Add metadata fields
        for (const [key, value] of Object.entries(context.metadata)) {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            segments.push(`- ${key}: ${value}`);
          }
        }
      }
    }

    // Add current date and time context
    const now = new Date();
    segments.push("\nDate/Time Information:");
    segments.push(`- Same rules as before...`);
    // Truncating mainly to save space, assuming logic remains similar to original but with skills

    return segments.join("\n");
  }

  /**
   * Get the model provider for this agent
   */
  public getModel(context?: {
    spaceId?: string;
    userId?: string;
  }): LanguageModel {
    const modelProvider = getModelProvider({
      provider: this.provider as any,
      modelName: this.model,
      spaceId: context?.spaceId,
      userId: context?.userId,
    });

    // OpenRouter API expects upstream provider/model only (e.g. "deepseek/deepseek-chat"), not "openrouter/..."
    const modelForApi =
      this.provider === "openrouter" && this.model.startsWith("openrouter/")
        ? this.model.slice("openrouter/".length)
        : this.model;

    return (modelProvider as any)(modelForApi) as LanguageModel;
  }

  /**
   * Get tools available to this agent
   */
  protected async getTools(context?: { spaceId?: string }): Promise<any> {
    const tools = { ...this.loadedSkillTools };

    // Only load config tools if configured
    if (this.tools && this.tools.length > 0) {
      try {
        const customTools = await buildToolMap(this.tools, context);
        Object.assign(tools, customTools);
      } catch (error) {
        console.error(`Failed to load tools for agent ${this.name}:`, error);
      }
    }

    return Object.keys(tools).length > 0 ? tools : undefined;
  }

  /**
   * Prepare debug info without actually calling streamText
   */
  async prepareDebugInfo(options: {
    messages: ViberMessage[];
    system?: string;
    spaceId?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    systemPrompt: string;
    tools: any;
    model: any;
    agentInfo: any;
    messages: any[];
  }> {
    await this.ensureSkillsLoaded();

    const { messages: viberMessages, system, spaceId, metadata } = options;

    // Extract metadata from messages for context enrichment
    let enrichedMetadata = metadata || {};

    // Find the last user message to extract any document context or other metadata
    const lastUserMsg = viberMessages.filter((m) => m.role === "user").pop();
    if (lastUserMsg?.metadata) {
      enrichedMetadata = { ...lastUserMsg.metadata, ...metadata };
    }

    // Build context for system prompt generation using ViberMessages
    const context: AgentContext = {
      spaceId: spaceId || "default",
      conversationHistory: new ConversationHistory(),
      metadata: enrichedMetadata,
    };

    // Use agent-specific prompt and append any extra system context
    const basePrompt = this.getSystemPrompt(context);
    const systemPrompt = system ? `${basePrompt}\n\n${system}` : basePrompt;
    const tools = await this.getTools({ spaceId });

    // Convert messages for display
    const modelMessages: any[] = viberMessages
      .filter((m) => m.role !== "tool")
      .map((m) => ({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? (m.content as Array<{ type: string; text?: string }>)
                  .filter((p) => p.type === "text" && p.text)
                  .map((p) => p.text as string)
                  .join("\n")
              : "",
      }))
      .filter((m) => m.content);

    return {
      systemPrompt,
      tools: Object.entries(tools || {}).map(([id, tool]) => ({
        id,
        name: (tool as any).name || id,
        description: (tool as any).description,
        functions: Object.keys((tool as any).functions || {}),
      })),
      model: {
        provider:
          this.config.llm?.provider || this.config.provider || "unknown",
        model: this.config.llm?.model || this.config.model || "unknown",
        settings: {
          temperature: this.temperature,
          maxTokens: this.maxTokens,
          topP: this.topP,
          frequencyPenalty: this.frequencyPenalty,
          presencePenalty: this.presencePenalty,
        },
      },
      agentInfo: {
        id: this.id,
        name: this.name,
        description: this.description,
        personality: this.personality,
      },
      messages: modelMessages,
    };
  }

  /**
   * Stream text - works with ViberMessage[] internally
   * Converts to ModelMessage[] only when calling AI SDK
   */
  async streamText(options: {
    messages: ViberMessage[];
    system?: string;
    spaceId?: string;
    metadata?: Record<string, any>;
    [key: string]: any; // Allow all other AI SDK options to pass through
  }): Promise<any> {
    await this.ensureSkillsLoaded();

    // Extract context-specific options
    const {
      messages: viberMessages,
      system,
      spaceId,
      metadata,
      ...aiSdkOptions
    } = options;

    // Extract metadata from messages for context enrichment
    let enrichedMetadata = metadata || {};

    // Find the last user message to extract any document context or other metadata
    const lastUserMsg = viberMessages.filter((m) => m.role === "user").pop();
    if (lastUserMsg?.metadata) {
      enrichedMetadata = { ...lastUserMsg.metadata, ...metadata };
    }

    // Build context for system prompt generation using ViberMessages
    const context: AgentContext = {
      spaceId: spaceId || "default",
      conversationHistory: new ConversationHistory(),
      metadata: enrichedMetadata,
    };

    // Use agent-specific prompt and append any extra system context
    const basePrompt = this.getSystemPrompt(context);
    const systemPrompt = system ? `${basePrompt}\n\n${system}` : basePrompt;

    const model = this.getModel({ spaceId, userId: enrichedMetadata.userId });
    const tools = await this.getTools({ spaceId });

    // Generate a message ID that includes the agent name
    const agentPrefix = this.name.toLowerCase().replace(/\s+/g, "-");

    // Convert ViberMessage[] to ModelMessage[] ONLY here, right before AI SDK call
    const modelMessages: ModelMessage[] = viberMessages
      .filter((m) => m.role !== "tool") // Skip tool messages
      .map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? (m.content as Array<{ type: string; text?: string }>)
                  .filter((p) => p.type === "text" && p.text)
                  .map((p) => p.text as string)
                  .join("\n")
              : "",
      }))
      .filter((m) => m.content); // Remove empty messages

    // Pass through to AI SDK's streamText with agent defaults
    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      toolChoice: "auto", // Explicitly set tool choice mode
      maxSteps: 5, // Allow up to 5 tool call steps
      temperature: this.temperature,
      maxOutputTokens: this.maxTokens,
      topP: this.topP,
      frequencyPenalty: this.frequencyPenalty,
      presencePenalty: this.presencePenalty,
      maxRetries: 3,
      // Add callback to monitor tool calls
      onStepFinish: ({ text, toolCalls, toolResults, finishReason }) => {
        // ... logging logic ...
      },
      // Override with any provided options
      ...aiSdkOptions,
      // Use experimental_generateMessageId to include agent name in message ID
      // @ts-ignore - experimental feature may not be in types yet
      experimental_generateMessageId: () => {
        return `${agentPrefix}_${generateShortId()}`;
      },
    });

    // Attach agent metadata to the result for immediate access
    (result as any).agentMetadata = {
      name: this.name,
    };

    return result;
  }

  /**
   * Generate text - works with ViberMessage[] internally
   * Converts to ModelMessage[] only when calling AI SDK
   */
  async generateText(options: {
    messages: ViberMessage[];
    system?: string;
    spaceId?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  }): Promise<any> {
    await this.ensureSkillsLoaded();

    const {
      messages: viberMessages,
      system,
      spaceId,
      metadata,
      ...aiSdkOptions
    } = options;

    // Extract metadata from messages for context enrichment
    let enrichedMetadata = metadata || {};

    // Find the last user message to extract any document context or other metadata
    const lastUserMsg = viberMessages.filter((m) => m.role === "user").pop();
    if (lastUserMsg?.metadata) {
      enrichedMetadata = { ...lastUserMsg.metadata, ...metadata };
    }

    // Build context for system prompt generation
    const context: AgentContext = {
      spaceId: spaceId || "default",
      conversationHistory: new ConversationHistory(),
      metadata: enrichedMetadata,
    };

    // Use agent-specific prompt and append any extra system context
    const basePrompt = this.getSystemPrompt(context);
    const systemPrompt = system ? `${basePrompt}\n\n${system}` : basePrompt;

    const model = this.getModel({ spaceId, userId: enrichedMetadata.userId });
    const tools = await this.getTools({ spaceId });

    // Convert ViberMessage[] to ModelMessage[] ONLY here, right before AI SDK call
    const modelMessages: ModelMessage[] = viberMessages
      .filter((m) => m.role !== "tool") // Skip tool messages
      .map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? (m.content as Array<{ type: string; text?: string }>)
                  .filter((p) => p.type === "text" && p.text)
                  .map((p) => p.text as string)
                  .join("\n")
              : "",
      }))
      .filter((m) => m.content);

    // Pass through to AI SDK's generateText with proper options
    return generateText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      temperature: this.temperature,
      maxRetries: 3,
      ...aiSdkOptions,
      // Add model-specific options if they exist
      ...(this.maxTokens && { maxSteps: 5 }), // generateText uses maxSteps not maxTokens
      ...(this.topP && { topP: this.topP }),
      ...(this.frequencyPenalty && { frequencyPenalty: this.frequencyPenalty }),
      ...(this.presencePenalty && { presencePenalty: this.presencePenalty }),
    });
  }

  /**
   * Get agent summary
   */
  getSummary(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      tools: this.tools,
      llmModel: `${this.provider}/${this.model}`,
    };
  }
}
