/**
 * Plan - Manages the execution plan for a space
 */

import { Task, TaskStatus } from "./task";

export interface PlanSummary {
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  failedTasks: number;
  blockedTasks: number;
  progressPercentage: number;
}

export class Plan {
  public tasks: Task[];
  public goal: string;
  public createdAt: Date;
  public updatedAt: Date;

  constructor({ tasks = [], goal }: { tasks?: Task[]; goal: string }) {
    this.tasks = tasks;
    this.goal = goal;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  addTask(task: Task): void {
    this.tasks.push(task);
    this.updatedAt = new Date();
  }

  removeTask(taskId: string): boolean {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index >= 0) {
      this.tasks.splice(index, 1);
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  getTaskById(taskId: string): Task | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }

  updateTaskStatus(taskId: string, status: TaskStatus): boolean {
    const task = this.getTaskById(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  getNextActionableTask(): Task | undefined {
    return this.tasks.find((task) =>
      task.isActionable({
        getTaskStatus: (id) => this.getTaskById(id)?.status,
      })
    );
  }

  getAllActionableTasks(maxTasks?: number): Task[] {
    const actionableTasks = this.tasks.filter((task) =>
      task.isActionable({
        getTaskStatus: (id) => this.getTaskById(id)?.status,
      })
    );
    return maxTasks ? actionableTasks.slice(0, maxTasks) : actionableTasks;
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this.tasks.filter((task) => task.status === status);
  }

  getTasksByAssignee(assignee: string): Task[] {
    return this.tasks.filter((task) => task.assignedTo === assignee);
  }

  isComplete(): boolean {
    return this.tasks.every(
      (task) =>
        task.status === TaskStatus.COMPLETED ||
        task.status === TaskStatus.CANCELLED
    );
  }

  hasFailedTasks(): boolean {
    return this.tasks.some((task) => task.status === TaskStatus.FAILED);
  }

  hasBlockedTasks(): boolean {
    return this.tasks.some((task) => task.status === TaskStatus.BLOCKED);
  }

  getProgressSummary(): PlanSummary {
    const summary: PlanSummary = {
      totalTasks: this.tasks.length,
      completedTasks: 0,
      runningTasks: 0,
      pendingTasks: 0,
      failedTasks: 0,
      blockedTasks: 0,
      progressPercentage: 0,
    };

    for (const task of this.tasks) {
      switch (task.status) {
        case TaskStatus.COMPLETED:
          summary.completedTasks++;
          break;
        case TaskStatus.RUNNING:
          summary.runningTasks++;
          break;
        case TaskStatus.PENDING:
          summary.pendingTasks++;
          break;
        case TaskStatus.FAILED:
          summary.failedTasks++;
          break;
        case TaskStatus.BLOCKED:
          summary.blockedTasks++;
          break;
      }
    }

    if (summary.totalTasks > 0) {
      summary.progressPercentage =
        (summary.completedTasks / summary.totalTasks) * 100;
    }

    return summary;
  }

  reorderTasks(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.tasks.length ||
      toIndex < 0 ||
      toIndex >= this.tasks.length
    ) {
      throw new Error("Invalid task indices");
    }

    const [task] = this.tasks.splice(fromIndex, 1);
    this.tasks.splice(toIndex, 0, task);
    this.updatedAt = new Date();
  }

  toJSON(): any {
    return {
      tasks: this.tasks.map((task) => task.toJSON()),
      goal: this.goal,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: any): Plan {
    const plan = new Plan({
      goal: data.goal,
      tasks: data.tasks.map((taskData: any) => Task.fromJSON(taskData)),
    });

    plan.createdAt = new Date(data.createdAt);
    plan.updatedAt = new Date(data.updatedAt);

    return plan;
  }
}
