/**
 * Task - Individual execution units within a space
 */

export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  BLOCKED = "blocked",
  CANCELLED = "cancelled",
}

export interface TaskStep {
  id: string;
  description: string;
  status: TaskStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface TaskDependency {
  taskId: string;
  type: "required" | "optional";
}

export class Task {
  public id: string;
  public title: string;
  public description: string;
  public status: TaskStatus;
  public assignedTo?: string;
  public priority: "low" | "medium" | "high";
  public estimatedTime?: string;
  public actualTime?: string;
  public dependencies: TaskDependency[];
  public steps: TaskStep[];
  public tags: string[];
  public metadata: Record<string, any>;
  public createdAt: Date;
  public updatedAt: Date;
  public startedAt?: Date;
  public completedAt?: Date;
  public error?: string;

  constructor({
    id,
    title,
    description,
    status = TaskStatus.PENDING,
    assignedTo,
    priority = "medium",
    estimatedTime,
    dependencies = [],
    steps = [],
    tags = [],
    metadata = {},
  }: {
    id: string;
    title: string;
    description: string;
    status?: TaskStatus;
    assignedTo?: string;
    priority?: "low" | "medium" | "high";
    estimatedTime?: string;
    dependencies?: TaskDependency[];
    steps?: TaskStep[];
    tags?: string[];
    metadata?: Record<string, any>;
  }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.status = status;
    this.assignedTo = assignedTo;
    this.priority = priority;
    this.estimatedTime = estimatedTime;
    this.dependencies = dependencies;
    this.steps = steps;
    this.tags = tags;
    this.metadata = metadata;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  start(): void {
    if (this.status !== TaskStatus.PENDING) {
      throw new Error(`Cannot start task in ${this.status} status`);
    }
    this.status = TaskStatus.RUNNING;
    this.startedAt = new Date();
    this.updatedAt = new Date();
  }

  complete(): void {
    if (this.status !== TaskStatus.RUNNING) {
      throw new Error(`Cannot complete task in ${this.status} status`);
    }
    this.status = TaskStatus.COMPLETED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
    if (this.startedAt) {
      this.actualTime = this.calculateDuration(
        this.startedAt,
        this.completedAt
      );
    }
  }

  fail(error: string): void {
    this.status = TaskStatus.FAILED;
    this.error = error;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  block(reason: string): void {
    this.status = TaskStatus.BLOCKED;
    this.error = reason;
    this.updatedAt = new Date();
  }

  cancel(): void {
    this.status = TaskStatus.CANCELLED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  isActionable(context?: { getTaskStatus: (id: string) => TaskStatus | undefined }): boolean {
    return (
      this.status === TaskStatus.PENDING && !this.hasBlockingDependencies(context)
    );
  }

  hasBlockingDependencies(context?: { getTaskStatus: (id: string) => TaskStatus | undefined }): boolean {
    if (!context || !this.dependencies || this.dependencies.length === 0) {
      return false;
    }

    return this.dependencies.some((dep) => {
      // Only required dependencies block execution
      if (dep.type === "optional") return false;

      const status = context.getTaskStatus(dep.taskId);
      // Block if dependency is not completed (or cancelled/failed if strict, but let's say COMPLETED)
      // If status is undefined (task not found), we assume it's missing -> blocking
      return status !== TaskStatus.COMPLETED;
    });
  }

  private calculateDuration(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  toJSON(): any {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      status: this.status,
      assignedTo: this.assignedTo,
      priority: this.priority,
      estimatedTime: this.estimatedTime,
      actualTime: this.actualTime,
      dependencies: this.dependencies,
      steps: this.steps,
      tags: this.tags,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      startedAt: this.startedAt?.toISOString(),
      completedAt: this.completedAt?.toISOString(),
      error: this.error,
    };
  }

  static fromJSON(data: any): Task {
    const task = new Task({
      id: data.id,
      title: data.title,
      description: data.description,
      status: data.status,
      assignedTo: data.assignedTo,
      priority: data.priority,
      estimatedTime: data.estimatedTime,
      dependencies: data.dependencies,
      steps: data.steps,
      tags: data.tags,
      metadata: data.metadata,
    });

    task.createdAt = new Date(data.createdAt);
    task.updatedAt = new Date(data.updatedAt);
    task.actualTime = data.actualTime;
    task.error = data.error;

    if (data.startedAt) {
      task.startedAt = new Date(data.startedAt);
    }
    if (data.completedAt) {
      task.completedAt = new Date(data.completedAt);
    }

    return task;
  }
}
