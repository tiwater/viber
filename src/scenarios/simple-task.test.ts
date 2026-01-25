import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestAgent, createTestMessage } from "../test-utils/factories";
import { buildToolMap } from "../core/tool";
import { z } from "zod";
import * as ai from "ai";

// Mock AI SDK at the top level
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: vi.fn(),
    generateText: vi.fn(),
  };
});

// Mock tools
vi.mock("../core/tool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/tool")>();
  return {
    ...actual,
    buildToolMap: vi.fn(),
  };
});

describe("Scenario: Simple Task Execution", () => {
  const mockToolExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockToolExecute.mockImplementation(async ({ a, b }) => Number(a) + Number(b));

    // Configure the tool map to return our calculator tool
    (buildToolMap as any).mockResolvedValue({
      calculator: {
        description: "Add two numbers",
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: mockToolExecute,
      },
    });
  });

  it("should execute a tool based on user request", async () => {
    const agent = createTestAgent({
      name: "Math Agent",
      tools: ["calculator"],
    });

    // Mock the AI SDK response to simulate the LLM deciding to call the tool
    (ai.streamText as any).mockImplementation((opts: any) => {
       const { onStepFinish } = opts;

       if (onStepFinish) {
         // 1. Tool Call
         onStepFinish({
           text: null,
           toolCalls: [{ toolName: 'calculator', input: { a: 2, b: 3 } }],
           toolResults: [{ toolName: 'calculator', output: 5 }],
           finishReason: 'tool-calls'
         });

         // 2. Final Response
         onStepFinish({
            text: "The answer is 5",
            toolCalls: [],
            toolResults: [],
            finishReason: 'stop'
         });
       }

       return {
         fullStream: (async function* () {
             yield { type: 'text-delta', textChunk: 'The answer is 5' };
             yield { type: 'finish', finishReason: 'stop' };
         })(),
         textStream: (async function* () { yield "The answer is 5"; })(),
         text: Promise.resolve("The answer is 5"),
         agentMetadata: { name: "Math Agent" },
       };
    });

    const result = await agent.streamText({
      messages: [createTestMessage("user", "Calculate 2 + 3")],
    });

    await expect(result.text).resolves.toBe("The answer is 5");

    // Verify tools were loaded
    expect(buildToolMap).toHaveBeenCalledWith(["calculator"], expect.anything());
  });
});
