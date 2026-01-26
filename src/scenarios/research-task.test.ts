import { describe, it, expect, vi, beforeEach } from "vitest";
import { Agent } from "../core/agent";
import { createAgentConfig, createMessage } from "../test-utils/factories";
import { mockLLM } from "../test-utils/mock-llm";

// Mock AI SDK
vi.mock("ai", () => ({
  streamText: (opts: any) => mockLLM.handleStreamText(opts),
  generateText: (opts: any) => mockLLM.handleGenerateText(opts),
}));

// Mock provider
vi.mock("../core/provider", () => ({
  getModelProvider: () => (model: string) => ({
    modelId: model,
    provider: "mock",
  }),
}));

// Mock tools
vi.mock("../core/tool", () => ({
  buildToolMap: vi.fn(() => Promise.resolve({
    "search": {
      description: "Search the web",
      execute: async (args: any) => `Results for ${args.query}`,
      inputSchema: {}
    }
  })),
}));

describe("Scenario: Research Task", () => {
  let agent: Agent;
  const config = createAgentConfig({
    tools: ["search"],
    systemPrompt: "You are a researcher."
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM.reset();
    agent = new Agent(config);
  });

  it("should handle a research request flow", async () => {
    // 1. User asks to research
    const messages = [createMessage("user", "Research quantum computing")];

    // 2. Mock LLM decides to call search tool
    mockLLM.queueToolCall("search", { query: "quantum computing" });

    // 3. Agent processes request
    const result1 = await agent.streamText({ messages });

    // Verify tool call
    expect(result1.toolCalls).toHaveLength(1);
    expect(result1.toolCalls[0].toolName).toBe("search");
    expect(result1.toolCalls[0].args).toEqual({ query: "quantum computing" });

    // Note: Since we mock streamText, the "auto-execution" loop of AI SDK is bypassed.
    // In a real integration test with a real model (or MockLanguageModel),
    // the tool would be executed and the loop would continue.
    // Here we verify that the Agent correctly configured the call and returned the decision.

    // Verify correct options were passed to LLM
    const call = mockLLM.getLastCall();
    expect(call.options.system).toContain("You are a researcher");
    expect(call.options.maxSteps).toBe(5); // Verify loop is enabled
    expect(call.options.tools).toBeDefined();
  });
});
