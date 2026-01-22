import { describe, it, expect, beforeEach } from "vitest";
import { Task, TaskStatus, TaskDependency } from "./task";

describe("Task", () => {
  let task: Task;

  beforeEach(() => {
    task = new Task({
      id: "task-1",
      title: "Test Task",
      description: "A task for testing",
      priority: "medium",
    });
  });

  describe("constructor", () => {
    it("should initialize with required properties", () => {
      expect(task.id).toBe("task-1");
      expect(task.title).toBe("Test Task");
      expect(task.description).toBe("A task for testing");
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.priority).toBe("medium");
    });

    it("should set defaults for optional properties", () => {
      expect(task.dependencies).toEqual([]);
      expect(task.steps).toEqual([]);
      expect(task.tags).toEqual([]);
      expect(task.metadata).toEqual({});
    });

    it("should accept all optional properties", () => {
      const fullTask = new Task({
        id: "task-2",
        title: "Full Task",
        description: "Complete task",
        status: TaskStatus.RUNNING,
        assignedTo: "agent-1",
        priority: "high",
        estimatedTime: "2h",
        dependencies: [{ taskId: "task-1", type: "required" }],
        steps: [{ id: "step-1", description: "Step 1", status: TaskStatus.PENDING }],
        tags: ["important", "urgent"],
        metadata: { custom: "data" },
      });

      expect(fullTask.status).toBe(TaskStatus.RUNNING);
      expect(fullTask.assignedTo).toBe("agent-1");
      expect(fullTask.priority).toBe("high");
      expect(fullTask.dependencies).toHaveLength(1);
      expect(fullTask.tags).toContain("urgent");
    });

    it("should set timestamps", () => {
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("start", () => {
    it("should transition from PENDING to RUNNING", () => {
      task.start();
      expect(task.status).toBe(TaskStatus.RUNNING);
      expect(task.startedAt).toBeInstanceOf(Date);
    });

    it("should throw if not in PENDING status", () => {
      task.start();
      expect(() => task.start()).toThrow("Cannot start task in running status");
    });
  });

  describe("complete", () => {
    it("should transition from RUNNING to COMPLETED", () => {
      task.start();
      task.complete();
      expect(task.status).toBe(TaskStatus.COMPLETED);
      expect(task.completedAt).toBeInstanceOf(Date);
    });

    it("should calculate actual time", () => {
      task.start();
      // Simulate some time passing
      task.complete();
      expect(task.actualTime).toBeDefined();
    });

    it("should throw if not in RUNNING status", () => {
      expect(() => task.complete()).toThrow("Cannot complete task in pending status");
    });
  });

  describe("fail", () => {
    it("should set status to FAILED with error", () => {
      task.fail("Something went wrong");
      expect(task.status).toBe(TaskStatus.FAILED);
      expect(task.error).toBe("Something went wrong");
      expect(task.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("block", () => {
    it("should set status to BLOCKED with reason", () => {
      task.block("Waiting for dependencies");
      expect(task.status).toBe(TaskStatus.BLOCKED);
      expect(task.error).toBe("Waiting for dependencies");
    });
  });

  describe("cancel", () => {
    it("should set status to CANCELLED", () => {
      task.cancel();
      expect(task.status).toBe(TaskStatus.CANCELLED);
      expect(task.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("isActionable", () => {
    it("should return true for PENDING task without blocking dependencies", () => {
      expect(task.isActionable()).toBe(true);
    });

    it("should return false for non-PENDING task", () => {
      task.start();
      expect(task.isActionable()).toBe(false);
    });
  });

  describe("hasBlockingDependencies", () => {
    it("should return false by default", () => {
      expect(task.hasBlockingDependencies()).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("should serialize task to JSON", () => {
      task.start();
      const json = task.toJSON();

      expect(json.id).toBe("task-1");
      expect(json.title).toBe("Test Task");
      expect(json.status).toBe(TaskStatus.RUNNING);
      expect(typeof json.createdAt).toBe("string");
      expect(typeof json.startedAt).toBe("string");
    });
  });

  describe("fromJSON", () => {
    it("should deserialize task from JSON", () => {
      const json = task.toJSON();
      const restored = Task.fromJSON(json);

      expect(restored.id).toBe(task.id);
      expect(restored.title).toBe(task.title);
      expect(restored.description).toBe(task.description);
      expect(restored.createdAt.getTime()).toBe(task.createdAt.getTime());
    });

    it("should restore dates correctly", () => {
      task.start();
      task.complete();
      const json = task.toJSON();
      const restored = Task.fromJSON(json);

      expect(restored.startedAt).toBeInstanceOf(Date);
      expect(restored.completedAt).toBeInstanceOf(Date);
    });
  });
});

describe("TaskStatus", () => {
  it("should have all expected statuses", () => {
    expect(TaskStatus.PENDING).toBe("pending");
    expect(TaskStatus.RUNNING).toBe("running");
    expect(TaskStatus.COMPLETED).toBe("completed");
    expect(TaskStatus.FAILED).toBe("failed");
    expect(TaskStatus.BLOCKED).toBe("blocked");
    expect(TaskStatus.CANCELLED).toBe("cancelled");
  });
});
