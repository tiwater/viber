import { vi } from "vitest";

export type MockResponse =
  | { type: "text"; text: string }
  | { type: "tool-call"; toolName: string; args: any; toolCallId?: string };

export class MockLLMProvider {
  private queue: MockResponse[] = [];
  private calls: any[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.queue = [];
    this.calls = [];
  }

  queueText(text: string) {
    this.queue.push({ type: "text", text });
  }

  queueToolCall(toolName: string, args: any, toolCallId: string = "call_1") {
    this.queue.push({ type: "tool-call", toolName, args, toolCallId });
  }

  getCalls() {
    return this.calls;
  }

  getLastCall() {
    return this.calls[this.calls.length - 1];
  }

  // Implementation for streamText
  async handleStreamText(options: any) {
    this.calls.push({ method: "streamText", options });
    const response = this.queue.shift();

    if (!response) {
      // Default fallback
      return {
        fullStream: (async function* () {
          yield { type: "text-delta", text: "" };
          yield { type: "finish", finishReason: "stop" };
        })(),
        textStream: (async function* () {
           yield "";
        })(),
        text: "",
        agentMetadata: { name: "mock-agent" },
      };
    }

    if (response.type === "text") {
        return {
          fullStream: (async function* () {
            yield { type: "text-delta", text: response.text };
            yield { type: "finish", finishReason: "stop" };
          })(),
          textStream: (async function* () {
            yield response.text;
          })(),
          text: response.text,
          agentMetadata: { name: "mock-agent" },
        };
    } else {
        // Tool call
        return {
           fullStream: (async function* () {
             yield {
                 type: "tool-call",
                 toolCallId: response.toolCallId,
                 toolName: response.toolName,
                 args: response.args
             };
             yield { type: "finish", finishReason: "tool-calls" };
           })(),
           textStream: (async function* () { yield ""; })(),
           text: "",
           toolCalls: [{
               toolCallId: response.toolCallId,
               toolName: response.toolName,
               args: response.args,
               type: 'tool-call'
           }],
           agentMetadata: { name: "mock-agent" },
        };
    }
  }

  // Implementation for generateText
  async handleGenerateText(options: any) {
    this.calls.push({ method: "generateText", options });
    const response = this.queue.shift();

    if (!response) {
        return {
            text: "",
            toolCalls: [],
            finishReason: "stop"
        };
    }

    if (response.type === "text") {
        return {
            text: response.text,
            toolCalls: [],
            finishReason: "stop"
        };
    } else {
        return {
            text: "",
            toolCalls: [{
                toolCallId: response.toolCallId,
                toolName: response.toolName,
                args: response.args,
                type: 'tool-call'
            }],
            finishReason: "tool-calls"
        };
    }
  }
}

export const mockLLM = new MockLLMProvider();
