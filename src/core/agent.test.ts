import { describe, it, expect, vi, beforeEach } from "vitest";
import { Agent, AgentContext } from "./agent";
import { AgentConfig } from "./config";
import { ViberMessage, ConversationHistory } from "./message";

// Mock the AI SDK using test-utils
vi.mock("ai", async () => {
  const { createMockAIProvider } = await import("../test-utils");
  return createMockAIProvider();
});

// Mock provider
vi.mock("./provider", () => ({
  getModelProvider: () => (model: string) => ({
    modelId: model,
    provider: "mock",
  }),
}));

// Mock tool builder
vi.mock("./tool", () => ({
  buildToolMap: vi.fn(() => Promise.resolve({})),
}));

describe("Agent", () => {
  let agent: Agent;
  const testConfig: AgentConfig = {
    id: "test-agent",
    name: "Test Agent",
    description: "A test agent for unit testing",
    provider: "openai",
    model: "gpt-4",
    tools: [],
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: "You are a helpful test assistant.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new Agent(testConfig);
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(agent.id).toBe("test-agent");
      expect(agent.name).toBe("Test Agent");
      expect(agent.description).toBe("A test agent for unit testing");
      expect(agent.provider).toBe("openai");
      expect(agent.model).toBe("gpt-4");
      expect(agent.temperature).toBe(0.7);
      expect(agent.maxTokens).toBe(1000);
    });

    it("should use name as id if id is not provided", () => {
      const configWithoutId = { ...testConfig, id: undefined };
      const agentNoId = new Agent(configWithoutId);
      expect(agentNoId.id).toBe("Test Agent");
    });

    it("should handle llm config format", () => {
      const llmConfig: AgentConfig = {
        name: "LLM Agent",
        description: "Agent with LLM config",
        llm: {
          provider: "anthropic",
          model: "claude-3",
          settings: {
            temperature: 0.5,
            maxTokens: 2000,
          },
        },
      };
      const llmAgent = new Agent(llmConfig);
      expect(llmAgent.provider).toBe("anthropic");
      expect(llmAgent.model).toBe("claude-3");
      expect(llmAgent.temperature).toBe(0.5);
      expect(llmAgent.maxTokens).toBe(2000);
    });

    it("should throw error for viber provider", () => {
      const invalidConfig = { ...testConfig, provider: "viber" };
      expect(() => new Agent(invalidConfig)).toThrow("Invalid provider 'viber'");
    });
  });

  describe("getSystemPrompt", () => {
    it("should include agent identity", () => {
      const prompt = (agent as any).getSystemPrompt();
      expect(prompt).toContain("You are Test Agent");
      expect(prompt).toContain("A test agent for unit testing");
    });

    it("should include custom system prompt", () => {
      const prompt = (agent as any).getSystemPrompt();
      expect(prompt).toContain("You are a helpful test assistant.");
    });

    it("should include personality if set", () => {
      const agentWithPersonality = new Agent({
        ...testConfig,
        personality: "Friendly and helpful",
      });
      const prompt = (agentWithPersonality as any).getSystemPrompt();
      expect(prompt).toContain("Personality: Friendly and helpful");
    });

    it("should include context information", () => {
      const context: AgentContext = {
        spaceId: "test-space",
        taskId: "test-task",
        conversationHistory: new ConversationHistory(),
        metadata: { userId: "user-123" },
      };
      const prompt = (agent as any).getSystemPrompt(context);
      expect(prompt).toContain("Space ID: test-space");
      expect(prompt).toContain("Task ID: test-task");
    });

    it("should include date/time information", () => {
      const prompt = (agent as any).getSystemPrompt();
      expect(prompt).toContain("Date/Time Information:");
      expect(prompt).toContain("Current Date:");
    });
  });

  describe("getModel", () => {
    it("should return a model provider", () => {
      const model = agent.getModel();
      expect(model).toBeDefined();
    });

    it("should pass context to provider", () => {
      const model = agent.getModel({ spaceId: "space-1", userId: "user-1" });
      expect(model).toBeDefined();
    });
  });

  describe("getTools", () => {
    it("should return undefined for agent without tools", async () => {
      const tools = await (agent as any).getTools();
      expect(tools).toBeUndefined();
    });

    it("should load tools when configured", async () => {
      const agentWithTools = new Agent({
        ...testConfig,
        tools: ["search", "calculator"],
      });
      await (agentWithTools as any).getTools();
      const { buildToolMap } = await import("./tool");
      expect(buildToolMap).toHaveBeenCalled();
    });
  });

  describe("streamText", () => {
    it("should stream text response", async () => {
      const messages: ViberMessage[] = [
        { role: "user", content: "Hello" },
      ];

      const result = await agent.streamText({ messages });
      expect(result).toBeDefined();
      expect(result.agentMetadata).toBeDefined();
      expect(result.agentMetadata.name).toBe("Test Agent");
    });

    it("should include enriched metadata from user messages", async () => {
      const messages: ViberMessage[] = [
        {
          role: "user",
          content: "Process this document",
          metadata: { artifactId: "doc-123" },
        },
      ];

      await agent.streamText({ messages });
      // Should complete without errors
    });
  });

  describe("generateText", () => {
    it("should generate text response", async () => {
      const messages: ViberMessage[] = [
        { role: "user", content: "Hello" },
      ];

      const result = await agent.generateText({ messages });
      expect(result).toBeDefined();
    });

    it("should handle empty messages", async () => {
      const result = await agent.generateText({ messages: [] });
      expect(result).toBeDefined();
    });
  });

  describe("getSummary", () => {
    it("should return agent summary", () => {
      const summary = agent.getSummary();
      expect(summary.id).toBe("test-agent");
      expect(summary.name).toBe("Test Agent");
      expect(summary.description).toBe("A test agent for unit testing");
      expect(summary.llmModel).toBe("openai/gpt-4");
    });
  });

  describe("prepareDebugInfo", () => {
    it("should prepare debug info without calling LLM", async () => {
      const messages: ViberMessage[] = [
        { role: "user", content: "Hello" },
      ];

      const debugInfo = await agent.prepareDebugInfo({ messages });
      expect(debugInfo.systemPrompt).toBeDefined();
      expect(debugInfo.agentInfo.name).toBe("Test Agent");
      expect(debugInfo.messages).toHaveLength(1);
    });
  });
});
