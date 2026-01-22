import { describe, it, expect, beforeEach } from "vitest";
import { Plan, PlanSummary } from "./plan";
import { Task, TaskStatus } from "./task";

describe("Plan", () => {
  let plan: Plan;

  beforeEach(() => {
    plan = new Plan({ goal: "Complete the project" });
  });

  describe("constructor", () => {
    it("should initialize with goal", () => {
      expect(plan.goal).toBe("Complete the project");
      expect(plan.tasks).toEqual([]);
    });

    it("should initialize with tasks", () => {
      const tasks = [
        new Task({ id: "1", title: "Task 1", description: "First task" }),
        new Task({ id: "2", title: "Task 2", description: "Second task" }),
      ];
      const planWithTasks = new Plan({ goal: "Test", tasks });
      expect(planWithTasks.tasks).toHaveLength(2);
    });

    it("should set timestamps", () => {
      expect(plan.createdAt).toBeInstanceOf(Date);
      expect(plan.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("addTask", () => {
    it("should add task to plan", () => {
      const task = new Task({ id: "1", title: "Task 1", description: "Test" });
      plan.addTask(task);
      expect(plan.tasks).toHaveLength(1);
    });

    it("should update updatedAt", () => {
      const before = plan.updatedAt;
      const task = new Task({ id: "1", title: "Task 1", description: "Test" });
      plan.addTask(task);
      expect(plan.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe("removeTask", () => {
    it("should remove existing task", () => {
      const task = new Task({ id: "1", title: "Task 1", description: "Test" });
      plan.addTask(task);
      expect(plan.removeTask("1")).toBe(true);
      expect(plan.tasks).toHaveLength(0);
    });

    it("should return false for non-existent task", () => {
      expect(plan.removeTask("non-existent")).toBe(false);
    });
  });

  describe("getTaskById", () => {
    it("should return task by id", () => {
      const task = new Task({ id: "1", title: "Task 1", description: "Test" });
      plan.addTask(task);
      expect(plan.getTaskById("1")).toBe(task);
    });

    it("should return undefined for non-existent id", () => {
      expect(plan.getTaskById("non-existent")).toBeUndefined();
    });
  });

  describe("updateTaskStatus", () => {
    it("should update task status", () => {
      const task = new Task({ id: "1", title: "Task 1", description: "Test" });
      plan.addTask(task);
      task.start(); // Need to start first
      expect(plan.updateTaskStatus("1", TaskStatus.COMPLETED)).toBe(true);
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });

    it("should return false for non-existent task", () => {
      expect(plan.updateTaskStatus("non-existent", TaskStatus.COMPLETED)).toBe(false);
    });
  });

  describe("getNextActionableTask", () => {
    it("should return first actionable task", () => {
      const task1 = new Task({ id: "1", title: "Task 1", description: "Test" });
      const task2 = new Task({ id: "2", title: "Task 2", description: "Test" });
      plan.addTask(task1);
      plan.addTask(task2);

      expect(plan.getNextActionableTask()).toBe(task1);
    });

    it("should skip non-actionable tasks", () => {
      const task1 = new Task({ id: "1", title: "Task 1", description: "Test" });
      const task2 = new Task({ id: "2", title: "Task 2", description: "Test" });
      task1.start(); // No longer actionable
      plan.addTask(task1);
      plan.addTask(task2);

      expect(plan.getNextActionableTask()).toBe(task2);
    });

    it("should return undefined when no actionable tasks", () => {
      const task = new Task({ id: "1", title: "Task 1", description: "Test" });
      task.start();
      plan.addTask(task);

      expect(plan.getNextActionableTask()).toBeUndefined();
    });
  });

  describe("getAllActionableTasks", () => {
    it("should return all actionable tasks", () => {
      plan.addTask(new Task({ id: "1", title: "Task 1", description: "Test" }));
      plan.addTask(new Task({ id: "2", title: "Task 2", description: "Test" }));
      plan.addTask(new Task({ id: "3", title: "Task 3", description: "Test" }));

      expect(plan.getAllActionableTasks()).toHaveLength(3);
    });

    it("should respect maxTasks limit", () => {
      plan.addTask(new Task({ id: "1", title: "Task 1", description: "Test" }));
      plan.addTask(new Task({ id: "2", title: "Task 2", description: "Test" }));
      plan.addTask(new Task({ id: "3", title: "Task 3", description: "Test" }));

      expect(plan.getAllActionableTasks(2)).toHaveLength(2);
    });
  });

  describe("getTasksByStatus", () => {
    it("should filter tasks by status", () => {
      const task1 = new Task({ id: "1", title: "Task 1", description: "Test" });
      const task2 = new Task({ id: "2", title: "Task 2", description: "Test" });
      task1.start();
      plan.addTask(task1);
      plan.addTask(task2);

      expect(plan.getTasksByStatus(TaskStatus.RUNNING)).toHaveLength(1);
      expect(plan.getTasksByStatus(TaskStatus.PENDING)).toHaveLength(1);
    });
  });

  describe("getTasksByAssignee", () => {
    it("should filter tasks by assignee", () => {
      const task1 = new Task({
        id: "1",
        title: "Task 1",
        description: "Test",
        assignedTo: "agent-1",
      });
      const task2 = new Task({
        id: "2",
        title: "Task 2",
        description: "Test",
        assignedTo: "agent-2",
      });
      plan.addTask(task1);
      plan.addTask(task2);

      expect(plan.getTasksByAssignee("agent-1")).toHaveLength(1);
      expect(plan.getTasksByAssignee("agent-1")[0].id).toBe("1");
    });
  });

  describe("isComplete", () => {
    it("should return true when all tasks completed or cancelled", () => {
      const task1 = new Task({ id: "1", title: "Task 1", description: "Test" });
      const task2 = new Task({ id: "2", title: "Task 2", description: "Test" });
      task1.start();
      task1.complete();
      task2.cancel();
      plan.addTask(task1);
      plan.addTask(task2);

      expect(plan.isComplete()).toBe(true);
    });

    it("should return false when tasks pending", () => {
      plan.addTask(new Task({ id: "1", title: "Task 1", description: "Test" }));
      expect(plan.isComplete()).toBe(false);
    });

    it("should return true for empty plan", () => {
      expect(plan.isComplete()).toBe(true);
    });
  });

  describe("hasFailedTasks", () => {
    it("should return true when any task failed", () => {
      const task = new Task({ id: "1", title: "Task 1", description: "Test" });
      task.fail("Error");
      plan.addTask(task);

      expect(plan.hasFailedTasks()).toBe(true);
    });

    it("should return false when no failed tasks", () => {
      plan.addTask(new Task({ id: "1", title: "Task 1", description: "Test" }));
      expect(plan.hasFailedTasks()).toBe(false);
    });
  });

  describe("hasBlockedTasks", () => {
    it("should return true when any task blocked", () => {
      const task = new Task({ id: "1", title: "Task 1", description: "Test" });
      task.block("Blocked reason");
      plan.addTask(task);

      expect(plan.hasBlockedTasks()).toBe(true);
    });
  });

  describe("getProgressSummary", () => {
    it("should calculate correct summary", () => {
      const task1 = new Task({ id: "1", title: "Task 1", description: "Test" });
      const task2 = new Task({ id: "2", title: "Task 2", description: "Test" });
      const task3 = new Task({ id: "3", title: "Task 3", description: "Test" });
      const task4 = new Task({ id: "4", title: "Task 4", description: "Test" });

      task1.start();
      task1.complete();
      task2.start();
      task3.fail("Error");

      plan.addTask(task1);
      plan.addTask(task2);
      plan.addTask(task3);
      plan.addTask(task4);

      const summary = plan.getProgressSummary();

      expect(summary.totalTasks).toBe(4);
      expect(summary.completedTasks).toBe(1);
      expect(summary.runningTasks).toBe(1);
      expect(summary.failedTasks).toBe(1);
      expect(summary.pendingTasks).toBe(1);
      expect(summary.progressPercentage).toBe(25);
    });

    it("should handle empty plan", () => {
      const summary = plan.getProgressSummary();
      expect(summary.totalTasks).toBe(0);
      expect(summary.progressPercentage).toBe(0);
    });
  });

  describe("reorderTasks", () => {
    it("should reorder tasks", () => {
      plan.addTask(new Task({ id: "1", title: "First", description: "Test" }));
      plan.addTask(new Task({ id: "2", title: "Second", description: "Test" }));
      plan.addTask(new Task({ id: "3", title: "Third", description: "Test" }));

      plan.reorderTasks(0, 2);

      expect(plan.tasks[0].id).toBe("2");
      expect(plan.tasks[2].id).toBe("1");
    });

    it("should throw for invalid indices", () => {
      plan.addTask(new Task({ id: "1", title: "First", description: "Test" }));
      expect(() => plan.reorderTasks(-1, 0)).toThrow("Invalid task indices");
      expect(() => plan.reorderTasks(0, 5)).toThrow("Invalid task indices");
    });
  });

  describe("toJSON / fromJSON", () => {
    it("should serialize and deserialize correctly", () => {
      const task = new Task({ id: "1", title: "Task 1", description: "Test" });
      plan.addTask(task);

      const json = plan.toJSON();
      const restored = Plan.fromJSON(json);

      expect(restored.goal).toBe(plan.goal);
      expect(restored.tasks).toHaveLength(1);
      expect(restored.tasks[0].id).toBe("1");
    });

    it("should preserve timestamps", () => {
      const json = plan.toJSON();
      const restored = Plan.fromJSON(json);

      expect(restored.createdAt.getTime()).toBe(plan.createdAt.getTime());
    });
  });
});
