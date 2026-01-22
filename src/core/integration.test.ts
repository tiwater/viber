/**
 * Integration Tests for Viber Core
 *
 * These tests verify that components work together correctly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Plan } from "./plan";
import { Task, TaskStatus } from "./task";
import { ConversationHistory, MessageQueue } from "./message";

describe("Integration: Plan with Tasks", () => {
  it("should manage a complete task lifecycle through plan", () => {
    // Create plan with multiple tasks
    const plan = new Plan({ goal: "Build a feature" });

    const task1 = new Task({
      id: "design",
      title: "Design the feature",
      description: "Create design docs",
      priority: "high",
    });

    const task2 = new Task({
      id: "implement",
      title: "Implement the feature",
      description: "Write the code",
      priority: "medium",
      dependencies: [{ taskId: "design", type: "required" }],
    });

    const task3 = new Task({
      id: "test",
      title: "Test the feature",
      description: "Write and run tests",
      priority: "medium",
      dependencies: [{ taskId: "implement", type: "required" }],
    });

    plan.addTask(task1);
    plan.addTask(task2);
    plan.addTask(task3);

    // Initial state
    expect(plan.isComplete()).toBe(false);
    expect(plan.getProgressSummary().pendingTasks).toBe(3);

    // Start and complete first task
    task1.start();
    expect(plan.getProgressSummary().runningTasks).toBe(1);

    task1.complete();
    expect(plan.getProgressSummary().completedTasks).toBe(1);

    // Start second task
    task2.start();
    task2.complete();

    // Start and complete third task
    task3.start();
    task3.complete();

    // Plan should now be complete
    expect(plan.isComplete()).toBe(true);
    expect(plan.getProgressSummary().progressPercentage).toBe(100);
  });

  it("should handle task failures gracefully", () => {
    const plan = new Plan({ goal: "Test failure handling" });

    const task = new Task({
      id: "failing-task",
      title: "This will fail",
      description: "Task that fails",
    });

    plan.addTask(task);
    task.fail("Something went wrong");

    expect(plan.hasFailedTasks()).toBe(true);
    expect(plan.isComplete()).toBe(false);
    expect(plan.getProgressSummary().failedTasks).toBe(1);
  });

  it("should serialize and restore plan with tasks", () => {
    const plan = new Plan({ goal: "Serialization test" });

    const task = new Task({
      id: "task-1",
      title: "Test Task",
      description: "For serialization",
      tags: ["test", "serialize"],
      metadata: { custom: "data" },
    });

    task.start();
    plan.addTask(task);

    // Serialize
    const json = plan.toJSON();

    // Restore
    const restored = Plan.fromJSON(json);

    expect(restored.goal).toBe(plan.goal);
    expect(restored.tasks[0].id).toBe("task-1");
    expect(restored.tasks[0].status).toBe(TaskStatus.RUNNING);
    expect(restored.tasks[0].tags).toContain("serialize");
  });
});

describe("Integration: MessageQueue with ConversationHistory", () => {
  it("should process messages from queue into history", async () => {
    const queue = new MessageQueue();
    const history = new ConversationHistory();

    // Add messages to queue
    queue.add("First question");
    queue.add("Second question");
    queue.add("Third question");

    // Process messages from queue
    while (!queue.isEmpty()) {
      const msg = queue.next();
      if (msg) {
        history.add({
          role: "user",
          content: msg.content,
          metadata: { queueId: msg.id },
        });
        queue.complete(msg.id);
      }
    }

    expect(history.messages).toHaveLength(3);
    expect(queue.isEmpty()).toBe(true);
    expect(queue.isProcessing()).toBe(false);
  });

  it("should handle errors during processing", () => {
    const queue = new MessageQueue();
    const history = new ConversationHistory();

    queue.add("Will error");
    const msg = queue.next()!;

    // Simulate error
    queue.error(msg.id, "Processing failed");

    // Message should not be added to history on error
    expect(history.messages).toHaveLength(0);
    expect(queue.isProcessing()).toBe(false);
  });

  it("should support queue editing before processing", () => {
    const queue = new MessageQueue();

    const id1 = queue.add("Original message");
    queue.add("Second message");

    // Edit first message
    queue.edit(id1, "Edited message");

    // Reorder
    queue.reorder(id1, 1);

    const state = queue.getState();
    expect(state.queue[0].content).toBe("Second message");
    expect(state.queue[1].content).toBe("Edited message");
    expect(state.queue[1].edited).toBe(true);
  });
});

describe("Integration: Conversation Flow", () => {
  it("should build conversation history correctly", () => {
    const history = new ConversationHistory();

    // Simulate a multi-turn conversation
    history.add({
      role: "system",
      content: "You are a helpful assistant",
    });

    history.add({
      role: "user",
      content: "What is 2 + 2?",
    });

    history.add({
      role: "assistant",
      content: "2 + 2 equals 4.",
      metadata: { agentName: "Calculator" },
    });

    history.add({
      role: "user",
      content: "And multiply by 3?",
    });

    history.add({
      role: "assistant",
      content: "4 multiplied by 3 equals 12.",
      metadata: { agentName: "Calculator" },
    });

    // Convert to model messages
    const modelMessages = history.toModelMessages();

    // Should have all 5 messages
    expect(modelMessages).toHaveLength(5);

    // Should maintain order
    expect(modelMessages[0].role).toBe("system");
    expect(modelMessages[1].role).toBe("user");
    expect(modelMessages[2].role).toBe("assistant");

    // Get last N for context
    const recent = history.getLastN(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].role).toBe("user");
    expect(recent[1].role).toBe("assistant");
  });

  it("should handle mixed content types", () => {
    const history = new ConversationHistory();

    history.add({
      role: "user",
      content: [
        { type: "text", text: "Describe this image" },
        { type: "image", url: "https://example.com/image.jpg" },
      ],
    });

    history.add({
      role: "assistant",
      content: "I can see a beautiful landscape.",
    });

    const modelMessages = history.toModelMessages();

    // Image parts should be filtered, text extracted
    expect(modelMessages).toHaveLength(2);
    expect(modelMessages[0].content).toBe("Describe this image");
  });
});
