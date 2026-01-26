import { describe, it, expect } from "vitest";
import { Plan } from "../core/plan";
import { Task, TaskStatus } from "../core/task";
import { createPlan, createTask } from "../test-utils/factories";

describe("Scenario: Planning and Execution", () => {
  it("should handle a workflow with dependencies and failures", () => {
    // 1. Create Plan
    const plan = createPlan("Build a website");

    // 2. Create Tasks
    const designTask = createTask({ id: "design", title: "Design" });
    const backendTask = createTask({
      id: "backend",
      title: "Backend",
      dependencies: [{ taskId: "design", type: "required" }]
    });
    const frontendTask = createTask({
      id: "frontend",
      title: "Frontend",
      dependencies: [{ taskId: "design", type: "required" }, { taskId: "backend", type: "required" }]
    });

    plan.addTask(designTask);
    plan.addTask(backendTask);
    plan.addTask(frontendTask);

    // 3. Execution Phase 1: Design
    const context = { getTaskStatus: (id: string) => plan.getTaskById(id)?.status };

    expect(designTask.isActionable(context)).toBe(true);
    expect(backendTask.isActionable(context)).toBe(false); // Depends on design

    designTask.start();
    expect(plan.getProgressSummary().runningTasks).toBe(1);

    designTask.complete();
    expect(plan.getProgressSummary().completedTasks).toBe(1);

    // 4. Execution Phase 2: Backend Failure
    // Now backend should be actionable?
    // The Task class doesn't automatically check other tasks' status unless managed by a runner.
    // But we can check `isActionable` if we pass the plan or context?
    // Actually `isActionable` in `Task.ts` (based on reading) seems to check its own status.
    // Wait, let's check `Task.hasBlockingDependencies()`.
    // It probably needs access to other tasks.
    // The `Task` class has `dependencies` array but it's just config.
    // `Task` class doesn't seem to have a reference to other tasks or the Plan instance.
    // So logic to check dependencies must be external or `Task` is smarter than I think.

    // Let's assume for this scenario we are the "Runner" managing state manually.

    backendTask.start();
    backendTask.fail("Database connection failed");

    expect(plan.hasFailedTasks()).toBe(true);
    expect(backendTask.status).toBe(TaskStatus.FAILED);
    expect(plan.isComplete()).toBe(false);

    // 5. Recovery
    // "Fix" the issue and retry
    backendTask.status = TaskStatus.PENDING; // Manual reset
    backendTask.start();
    backendTask.complete();

    expect(plan.hasFailedTasks()).toBe(false);

    // 6. Execution Phase 3: Frontend
    frontendTask.start();
    frontendTask.complete();

    // 7. Verification
    expect(plan.isComplete()).toBe(true);
    expect(plan.getProgressSummary().progressPercentage).toBe(100);
  });
});
