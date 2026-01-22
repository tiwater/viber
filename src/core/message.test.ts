import { describe, it, expect, beforeEach } from "vitest";
import {
  Message,
  ViberMessage,
  MessageQueue,
  ConversationHistory,
  getTextContent,
} from "./message";

describe("Message Types", () => {
  describe("getTextContent", () => {
    it("should extract text from string content", () => {
      const message: Message = { role: "user", content: "Hello world" };
      expect(getTextContent(message)).toBe("Hello world");
    });

    it("should extract text from array content", () => {
      const message: Message = {
        role: "user",
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: "World" },
        ],
      };
      expect(getTextContent(message)).toBe("Hello World");
    });

    it("should filter non-text parts", () => {
      const message: Message = {
        role: "user",
        content: [
          { type: "text", text: "Hello" },
          { type: "image", url: "test.jpg" },
          { type: "text", text: "World" },
        ],
      };
      expect(getTextContent(message)).toBe("Hello World");
    });

    it("should handle empty content", () => {
      const message: Message = { role: "user", content: "" };
      expect(getTextContent(message)).toBe("");
    });

    it("should handle null/undefined message", () => {
      expect(getTextContent(null as any)).toBe("");
      expect(getTextContent(undefined as any)).toBe("");
    });
  });
});

describe("MessageQueue", () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  describe("add", () => {
    it("should add message to queue", () => {
      const id = queue.add("Hello");
      expect(id).toBeDefined();
      expect(id).toMatch(/^msg-\d+$/);
    });

    it("should increment message ids", () => {
      const id1 = queue.add("First");
      const id2 = queue.add("Second");
      expect(id1).not.toBe(id2);
    });

    it("should store metadata", () => {
      queue.add("Hello", { userId: "user-1" });
      const state = queue.getState();
      expect(state.queue[0].metadata).toEqual({ userId: "user-1" });
    });
  });

  describe("next", () => {
    it("should return next message and mark as processing", () => {
      queue.add("First");
      queue.add("Second");

      const msg = queue.next();
      expect(msg).toBeDefined();
      expect(msg?.content).toBe("First");
      expect(msg?.status).toBe("processing");
      expect(queue.isProcessing()).toBe(true);
    });

    it("should return undefined for empty queue", () => {
      expect(queue.next()).toBeUndefined();
    });
  });

  describe("complete", () => {
    it("should mark message as complete", () => {
      queue.add("Test");
      const msg = queue.next()!;
      queue.complete(msg.id);

      expect(queue.isProcessing()).toBe(false);
    });

    it("should ignore wrong message id", () => {
      queue.add("Test");
      queue.next();
      queue.complete("wrong-id");

      expect(queue.isProcessing()).toBe(true);
    });
  });

  describe("error", () => {
    it("should mark message as error", () => {
      queue.add("Test");
      const msg = queue.next()!;
      queue.error(msg.id, "Something went wrong");

      expect(queue.isProcessing()).toBe(false);
    });
  });

  describe("remove", () => {
    it("should remove queued message", () => {
      const id = queue.add("Test");
      expect(queue.remove(id)).toBe(true);
      expect(queue.isEmpty()).toBe(true);
    });

    it("should return false for non-existent message", () => {
      expect(queue.remove("non-existent")).toBe(false);
    });
  });

  describe("reorder", () => {
    it("should reorder messages", () => {
      queue.add("First");
      queue.add("Second");
      queue.add("Third");

      queue.reorder("msg-1", 2);

      const state = queue.getState();
      expect(state.queue[0].content).toBe("Second");
      expect(state.queue[2].content).toBe("First");
    });
  });

  describe("edit", () => {
    it("should edit queued message content", () => {
      const id = queue.add("Original");
      queue.edit(id, "Updated");

      const state = queue.getState();
      expect(state.queue[0].content).toBe("Updated");
      expect(state.queue[0].edited).toBe(true);
    });

    it("should not edit processing message", () => {
      queue.add("Original");
      const msg = queue.next()!;
      queue.edit(msg.id, "Updated"); // Should have no effect

      expect(queue.getState().current?.content).toBe("Original");
    });
  });

  describe("clear", () => {
    it("should clear all queued messages", () => {
      queue.add("First");
      queue.add("Second");
      queue.clear();

      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe("subscribe", () => {
    it("should notify subscribers on changes", () => {
      const callback = vi.fn();
      queue.subscribe(callback);

      queue.add("Test");

      expect(callback).toHaveBeenCalled();
    });

    it("should unsubscribe correctly", () => {
      const callback = vi.fn();
      const unsubscribe = queue.subscribe(callback);

      unsubscribe();
      queue.add("Test");

      expect(callback).toHaveBeenCalledTimes(0);
    });
  });

  describe("getState", () => {
    it("should return queue state", () => {
      queue.add("Test");
      const state = queue.getState();

      expect(state.queue).toHaveLength(1);
      expect(state.processing).toBe(false);
      expect(state.current).toBeUndefined();
    });
  });
});

describe("ConversationHistory", () => {
  let history: ConversationHistory;

  beforeEach(() => {
    history = new ConversationHistory();
  });

  describe("add", () => {
    it("should add message to history", () => {
      history.add({ role: "user", content: "Hello" });
      expect(history.messages).toHaveLength(1);
    });

    it("should generate id if not provided", () => {
      history.add({ role: "user", content: "Hello" });
      expect(history.messages[0].id).toBeDefined();
    });

    it("should preserve provided id", () => {
      history.add({ role: "user", content: "Hello", id: "custom-id" });
      expect(history.messages[0].id).toBe("custom-id");
    });

    it("should include agent name in id prefix", () => {
      history.add({
        role: "assistant",
        content: "Hi",
        metadata: { agentName: "Test Agent" },
      });
      expect(history.messages[0].id).toMatch(/^test-agent_/);
    });
  });

  describe("getMessages", () => {
    it("should return copy of messages", () => {
      history.add({ role: "user", content: "Hello" });
      const messages = history.getMessages();
      messages.push({ role: "user", content: "World" });

      expect(history.messages).toHaveLength(1);
    });
  });

  describe("getLastN", () => {
    it("should return last N messages", () => {
      history.add({ role: "user", content: "1" });
      history.add({ role: "assistant", content: "2" });
      history.add({ role: "user", content: "3" });

      const last2 = history.getLastN(2);
      expect(last2).toHaveLength(2);
      expect(last2[0].content).toBe("2");
      expect(last2[1].content).toBe("3");
    });
  });

  describe("clear", () => {
    it("should clear all messages", () => {
      history.add({ role: "user", content: "Hello" });
      history.clear();
      expect(history.messages).toHaveLength(0);
    });
  });

  describe("toModelMessages", () => {
    it("should convert to AI SDK format", () => {
      history.add({ role: "user", content: "Hello" });
      history.add({ role: "assistant", content: "Hi there" });

      const modelMessages = history.toModelMessages();
      expect(modelMessages).toHaveLength(2);
    });

    it("should skip tool messages", () => {
      history.add({ role: "user", content: "Hello" });
      history.add({ role: "tool", content: "Tool result" });
      history.add({ role: "assistant", content: "Done" });

      const modelMessages = history.toModelMessages();
      expect(modelMessages).toHaveLength(2);
    });

    it("should extract text from array content", () => {
      history.add({
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      });

      const modelMessages = history.toModelMessages();
      expect(modelMessages[0].content).toBe("Hello");
    });

    it("should skip messages with no content", () => {
      history.add({ role: "user", content: "" });
      history.add({ role: "assistant", content: "Hello" });

      const modelMessages = history.toModelMessages();
      expect(modelMessages).toHaveLength(1);
    });
  });
});

// Import vi for mock functions
import { vi } from "vitest";
