import { describe, it, expect, vi } from "vitest";
import { createTestAgent, createTestPlan, createTestTask } from "../test-utils/factories";
import { TaskStatus } from "../core/task";
import * as ai from "ai";

// Mock AI SDK at top level
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

describe("Scenario: Planning and Execution", () => {
  it("should allow agent to work on tasks from a plan", async () => {
    const plan = createTestPlan({ goal: "Build a website" });
    const agent = createTestAgent({ name: "Dev" });

    // Mock generateText
    (ai.generateText as any).mockResolvedValue({
        text: "I have executed the task.",
        toolCalls: []
    });

    // Add tasks
    const task1 = createTestTask({ title: "Design", id: "t1" });
    plan.addTask(task1);

    // Initial state
    expect(plan.getNextActionableTask()?.id).toBe("t1");

    // Execute Task 1
    const t1 = plan.getTaskById("t1")!;
    t1.start();

    // Simulate agent work
    await agent.generateText({
        messages: [{ role: "user", content: `Execute task: ${t1.title}` }]
    });

    t1.complete();

    // Check state updates
    expect(t1.status).toBe(TaskStatus.COMPLETED);
    expect(plan.getProgressSummary().completedTasks).toBe(1);
  });
});
