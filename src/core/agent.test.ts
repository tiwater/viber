import { describe, it, expect, vi, beforeEach } from "vitest";
import { Agent, AgentContext } from "./agent";
import { createAgentConfig, createMessage } from "../test-utils/factories";
import { ConversationHistory } from "./message";
import { mockLLM } from "../test-utils/mock-llm";

// Mock the AI SDK
// We need to use a function that delegates to our singleton
vi.mock("ai", () => ({
  streamText: (opts: any) => mockLLM.handleStreamText(opts),
  generateText: (opts: any) => mockLLM.handleGenerateText(opts),
}));

// Mock provider
vi.mock("./provider", () => ({
  getModelProvider: () => (model: string) => ({
    modelId: model,
    provider: "mock",
  }),
}));

// Mock tool builder
vi.mock("./tool", () => ({
  buildToolMap: vi.fn(() => Promise.resolve({
    "search": {
      description: "Search tool",
      execute: async () => "Search results",
      inputSchema: {}
    }
  })),
}));

describe("Agent", () => {
  let agent: Agent;
  const testConfig = createAgentConfig();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM.reset();
    agent = new Agent(testConfig);
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe("Test Agent");
      expect(agent.provider).toBe("openai");
    });
  });

  describe("getSystemPrompt", () => {
    it("should include agent identity", () => {
      const prompt = (agent as any).getSystemPrompt();
      expect(prompt).toContain("You are Test Agent");
    });

    it("should include artifact context", () => {
      const context: AgentContext = {
        spaceId: "space-1",
        conversationHistory: new ConversationHistory(),
        metadata: {
          artifactId: "doc-1",
          artifactPath: "/docs/test.pdf",
          artifactName: "test.pdf"
        }
      };
      const prompt = (agent as any).getSystemPrompt(context);
      expect(prompt).toContain("CURRENT FILE:");
      expect(prompt).toContain("/docs/test.pdf");
      expect(prompt).toContain("PDF file");
    });
  });

  describe("streamText", () => {
    it("should stream text response from mock LLM", async () => {
      mockLLM.queueText("Hello from Mock");

      const messages = [createMessage("user", "Hello")];
      const result = await agent.streamText({ messages });

      expect(result.text).toBe("Hello from Mock");
      expect(mockLLM.getCalls().length).toBe(1);
      expect(mockLLM.getLastCall().options.messages[0].content).toBe("Hello");
    });

    it("should handle tool calls from mock LLM", async () => {
      // Setup mock to return a tool call
      mockLLM.queueToolCall("search", { query: "vitest" });

      const messages = [createMessage("user", "Search for vitest")];
      const result = await agent.streamText({ messages });

      // The result from streamText (which calls ai.streamText)
      // when a tool is called depends on how ai.streamText handles it.
      // Our mock returns a structure with toolCalls.

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe("search");
    });
  });

  describe("generateText", () => {
    it("should generate text response", async () => {
      mockLLM.queueText("Generated response");

      const messages = [createMessage("user", "Hi")];
      const result = await agent.generateText({ messages });

      expect(result.text).toBe("Generated response");
    });
  });
});
