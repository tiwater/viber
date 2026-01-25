import { describe, it, expect, vi, beforeEach } from "vitest";
import { Agent, AgentContext } from "./agent";
import { AgentConfig } from "./config";
import { ViberMessage, ConversationHistory } from "./message";
import { createTestAgent } from "../test-utils/factories";

// Mock the AI SDK
const mockStreamText = vi.fn();
const mockGenerateText = vi.fn();

vi.mock("ai", () => ({
  streamText: (opts: any) => mockStreamText(opts),
  generateText: (opts: any) => mockGenerateText(opts),
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
    'search': {
      description: 'Search tool',
      inputSchema: {},
      execute: async () => 'Search results',
    }
  })),
}));

describe("Agent", () => {
  let agent: Agent;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock behavior
    mockStreamText.mockReturnValue({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Response" };
        yield { type: "finish", finishReason: "stop" };
      })(),
      textStream: (async function* () {
         yield "Response";
      })(),
      text: Promise.resolve("Response"),
      agentMetadata: { name: "Test Agent" },
    });

    mockGenerateText.mockResolvedValue({
      text: "Response",
      toolCalls: [],
    });

    agent = createTestAgent({
      tools: ['search']
    });
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(agent.name).toBe("Test Agent");
      expect(agent.provider).toBe("openai");
    });

    it("should throw error for viber provider", () => {
        expect(() => createTestAgent({ provider: "viber" })).toThrow("Invalid provider");
    });
  });

  describe("streamText", () => {
    it("should call AI SDK with correct parameters", async () => {
      const messages: ViberMessage[] = [
        { role: "user", content: "Hello" },
      ];

      await agent.streamText({ messages });

      expect(mockStreamText).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.stringContaining("You are Test Agent"),
        messages: expect.arrayContaining([
            expect.objectContaining({ role: "user", content: "Hello" })
        ]),
        tools: expect.anything(),
        toolChoice: "auto"
      }));
    });

    it("should handle tool execution callback (onStepFinish)", async () => {
      // Setup mock to simulate a tool call
      let onStepFinishCallback: any;
      mockStreamText.mockImplementation((opts) => {
        onStepFinishCallback = opts.onStepFinish;
        return {
          fullStream: (async function* () {})(),
          textStream: (async function* () {})(),
          text: Promise.resolve("Response"),
          agentMetadata: { name: "Test Agent" },
        };
      });

      await agent.streamText({ messages: [{ role: 'user', content: 'Search something' }] });

      // Simulate tool execution finishing
      expect(onStepFinishCallback).toBeDefined();

      const consoleSpy = vi.spyOn(console, 'log');

      onStepFinishCallback({
        text: "I found something",
        toolCalls: [{ toolName: 'search', input: { query: 'test' } }],
        toolResults: [{ toolName: 'search', output: 'results' }],
        finishReason: 'stop'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Tool Call"),
        expect.anything()
      );
    });

    it("should include enriched metadata from messages", async () => {
        const messages: ViberMessage[] = [
            {
                role: "user",
                content: "Contextual query",
                metadata: { userId: "user-123", artifactId: "art-1" }
            }
        ];

        // Spy on getSystemPrompt to check context
        const promptSpy = vi.spyOn(agent as any, 'getSystemPrompt');

        await agent.streamText({ messages });

        expect(promptSpy).toHaveBeenCalledWith(expect.objectContaining({
            metadata: expect.objectContaining({
                userId: "user-123",
                artifactId: "art-1"
            })
        }));
    });
  });

  describe("getSystemPrompt", () => {
    it("should include context in system prompt", () => {
        const context: AgentContext = {
            spaceId: "space-1",
            conversationHistory: new ConversationHistory(),
            metadata: { userId: "user-1", artifactId: "doc-1", artifactName: "test.pdf" }
        };

        const prompt = (agent as any).getSystemPrompt(context);
        expect(prompt).toContain("Space ID: space-1");
        expect(prompt).toContain("CURRENT FILE");
        expect(prompt).toContain("test.pdf");
    });
  });

  describe("generateText", () => {
    it("should call generateText with correct parameters", async () => {
        const messages: ViberMessage[] = [{ role: "user", content: "Hi" }];
        await agent.generateText({ messages });

        expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
            maxRetries: 3
        }));
    });
  });

  describe("prepareDebugInfo", () => {
      it("should return debug info structure", async () => {
          const messages: ViberMessage[] = [{ role: "user", content: "Hi" }];
          const info = await agent.prepareDebugInfo({ messages });

          expect(info).toHaveProperty("systemPrompt");
          expect(info).toHaveProperty("tools");
          expect(info.agentInfo.name).toBe("Test Agent");
      });
  });
});
