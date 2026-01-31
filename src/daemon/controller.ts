/**
 * ViberController - Daemon controller for outbound connection to command center
 *
 * A Viber is a local agent daemon that connects OUTBOUND to a central command center
 * (Supen). This eliminates the need for public IPs or port forwarding.
 *
 * Features:
 * - Persistent WebSocket connection to command center
 * - Auto-reconnection on disconnect
 * - Heartbeat/health monitoring
 * - Task execution and event streaming
 */

import { EventEmitter } from "events";
import WebSocket from "ws";
import type { ViberOptions } from "../core/viber-agent";
import { runTask } from "./runtime";
import { TerminalManager } from "./terminal";

// ==================== Types ====================

export interface ViberControllerConfig {
  /** WebSocket URL to connect to (e.g., wss://supen.app/vibers/ws) */
  serverUrl: string;
  /** Authentication token */
  token: string;
  /** Unique identifier for this viber */
  viberId: string;
  /** Human-readable name for this viber */
  viberName?: string;
  /** Milliseconds between reconnection attempts */
  reconnectInterval?: number;
  /** Milliseconds between heartbeat messages */
  heartbeatInterval?: number;
  /** Enable desktop control tools */
  enableDesktop?: boolean;
}

export interface ViberSkillInfo {
  id: string;
  name: string;
  description: string;
}

export interface ViberInfo {
  id: string;
  name: string;
  version: string;
  platform: string;
  capabilities: string[];
  runningTasks: string[];
  /** Skills available on this viber (from SKILL.md) */
  skills?: ViberSkillInfo[];
}

export interface ViberStatus {
  platform: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  runningTasks: number;
}

// Server -> Viber messages (messages = full chat history from cockpit for context)
export type ControllerServerMessage =
  | {
      type: "task:submit";
      taskId: string;
      goal: string;
      options?: ViberOptions;
      messages?: { role: string; content: string }[];
    }
  | { type: "task:stop"; taskId: string }
  | { type: "task:message"; taskId: string; message: string }
  | { type: "ping" }
  | { type: "config:update"; config: Partial<ViberControllerConfig> }
  // Terminal streaming messages
  | { type: "terminal:list" }
  | { type: "terminal:attach"; target: string }
  | { type: "terminal:detach"; target: string }
  | { type: "terminal:input"; target: string; keys: string };

// Viber -> Server messages
export type ControllerClientMessage =
  | { type: "connected"; viber: ViberInfo }
  | { type: "task:started"; taskId: string; spaceId: string }
  | { type: "task:progress"; taskId: string; event: any }
  | { type: "task:completed"; taskId: string; result: any }
  | { type: "task:error"; taskId: string; error: string }
  | { type: "heartbeat"; status: ViberStatus }
  | { type: "pong" }
  // Terminal streaming messages
  | { type: "terminal:list"; sessions: any[]; panes: any[] }
  | { type: "terminal:attached"; target: string; ok: boolean; error?: string }
  | { type: "terminal:detached"; target: string }
  | { type: "terminal:output"; target: string; data: string };

// ==================== Controller ====================

export class ViberController extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  /** taskId -> AbortController for stop (daemon = thin runtime, no Space/agent instance) */
  private runningTasks: Map<string, AbortController> = new Map();
  private isConnected = false;
  private shouldReconnect = true;
  /** Terminal manager for streaming tmux panes */
  private terminalManager = new TerminalManager();

  constructor(private config: ViberControllerConfig) {
    super();
  }

  /**
   * Start the viber daemon
   */
  async start(): Promise<void> {
    console.log(`[Viber] Starting viber: ${this.config.viberId}`);
    console.log(`[Viber] Connecting to: ${this.config.serverUrl}`);
    this.shouldReconnect = true;
    await this.connect();
  }

  /**
   * Stop the viber daemon
   */
  async stop(): Promise<void> {
    console.log("[Viber] Stopping viber...");
    this.shouldReconnect = false;

    for (const [taskId, controller] of this.runningTasks) {
      controller.abort();
      this.runningTasks.delete(taskId);
    }

    // Detach all terminal streams
    this.terminalManager.detachAll();

    // Clear timers
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.emit("stopped");
  }

  /**
   * Get current connection status
   */
  getStatus(): { connected: boolean; runningTasks: number } {
    return {
      connected: this.isConnected,
      runningTasks: this.runningTasks.size,
    };
  }

  // ==================== Connection Management ====================

  private async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(this.config.serverUrl, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "X-Viber-Id": this.config.viberId,
          "X-Viber-Version": "1.0.0",
        },
      });

      this.ws.on("open", () => {
        void this.onConnected();
      });
      this.ws.on("message", (data) => this.onMessage(data));
      this.ws.on("close", () => this.onDisconnected());
      this.ws.on("error", (err) => this.onError(err));
    } catch (error) {
      console.error("[Viber] Connection failed:", error);
      this.scheduleReconnect();
    }
  }

  private async onConnected(): Promise<void> {
    console.log("[Viber] Connected to command center");
    this.isConnected = true;

    const capabilities = ["file", "search", "web"];
    if (this.config.enableDesktop) {
      capabilities.push("desktop");
    }

    let skills: { id: string; name: string; description: string }[] = [];
    try {
      const { defaultRegistry } = await import("../skills/registry");
      await defaultRegistry.loadAll();
      const all = defaultRegistry.getAllSkills();
      skills = all.map((s) => ({
        id: s.id,
        name: s.metadata.name || s.id,
        description: s.metadata.description || "",
      }));
    } catch (err) {
      console.warn("[Viber] Could not load skills for capabilities:", err);
    }

    this.send({
      type: "connected",
      viber: {
        id: this.config.viberId,
        name: this.config.viberName || this.config.viberId,
        version: "1.0.0",
        platform: process.platform,
        capabilities,
        runningTasks: Array.from(this.runningTasks.keys()),
        skills: skills.length > 0 ? skills : undefined,
      },
    });

    this.startHeartbeat();
    this.emit("connected");
  }

  private onDisconnected(): void {
    console.log("[Viber] Disconnected from command center");
    this.isConnected = false;
    this.stopHeartbeat();

    if (this.shouldReconnect) {
      this.scheduleReconnect();
    }

    this.emit("disconnected");
  }

  private onError(error: Error): void {
    console.error("[Viber] WebSocket error:", error.message);
    this.emit("error", error);
  }

  private async onMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString()) as ControllerServerMessage;

      switch (message.type) {
        case "task:submit":
          await this.handleTaskSubmit(message);
          break;

        case "task:stop":
          await this.handleTaskStop(message.taskId);
          break;

        case "task:message":
          await this.handleTaskMessage(message.taskId, message.message);
          break;

        case "ping":
          this.send({ type: "pong" });
          break;

        case "config:update":
          Object.assign(this.config, message.config);
          this.emit("config:update", message.config);
          break;

        // Terminal streaming
        case "terminal:list":
          this.handleTerminalList();
          break;

        case "terminal:attach":
          await this.handleTerminalAttach(message.target);
          break;

        case "terminal:detach":
          this.handleTerminalDetach(message.target);
          break;

        case "terminal:input":
          this.handleTerminalInput(message.target, message.keys);
          break;
      }
    } catch (error) {
      console.error("[Viber] Failed to process message:", error);
    }
  }

  // ==================== Task Handling ====================

  private async handleTaskSubmit(message: {
    taskId: string;
    goal: string;
    options?: ViberOptions;
    messages?: { role: string; content: string }[];
  }): Promise<void> {
    const { taskId, goal, options, messages } = message;

    console.log(`[Viber] Received task: ${taskId}`);
    console.log(`[Viber] Goal: ${goal}`);

    const controller = new AbortController();
    this.runningTasks.set(taskId, controller);

    this.send({
      type: "task:started",
      taskId,
      spaceId: taskId,
    });

    try {
      const { streamResult, agent } = await runTask(
        goal,
        {
          taskId,
          model: options?.model,
          singleAgentId: options?.singleAgentId || "default",
          signal: controller.signal,
        },
        messages,
      );

      // Consume stream to completion; do not send intermediate chunks to cockpit by default.
      const finalText = await streamResult.text;

      this.send({
        type: "task:completed",
        taskId,
        result: {
          spaceId: taskId,
          text: finalText,
          summary: agent.getSummary(),
        },
      });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.log(`[Viber] Task ${taskId} stopped`);
      } else {
        console.error(`[Viber] Task ${taskId} execution error:`, error);
        this.send({
          type: "task:error",
          taskId,
          error: error.message,
        });
      }
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  private async handleTaskStop(taskId: string): Promise<void> {
    const controller = this.runningTasks.get(taskId);
    if (controller) {
      controller.abort();
      this.runningTasks.delete(taskId);
      console.log(`[Viber] Task stopped: ${taskId}`);
    }
  }

  private async handleTaskMessage(
    _taskId: string,
    _message: string,
  ): Promise<void> {
    // Daemon is thin: no in-memory conversation. Cockpit sends full messages on next task submit.
  }

  // ==================== Terminal Streaming ====================

  private handleTerminalList(): void {
    const { sessions, panes } = this.terminalManager.list();
    this.send({ type: "terminal:list", sessions, panes });
  }

  private async handleTerminalAttach(target: string): Promise<void> {
    console.log(`[Viber] Attaching to terminal: ${target}`);
    const ok = await this.terminalManager.attach(
      target,
      (data) => {
        this.send({ type: "terminal:output", target, data });
      },
      () => {
        this.send({ type: "terminal:detached", target });
      }
    );
    this.send({ type: "terminal:attached", target, ok });
  }

  private handleTerminalDetach(target: string): void {
    console.log(`[Viber] Detaching from terminal: ${target}`);
    this.terminalManager.detach(target);
    this.send({ type: "terminal:detached", target });
  }

  private handleTerminalInput(target: string, keys: string): void {
    this.terminalManager.sendInput(target, keys);
  }

  // ==================== Communication ====================

  private send(message: ControllerClientMessage): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // ==================== Heartbeat ====================

  private startHeartbeat(): void {
    const interval = this.config.heartbeatInterval || 30000;
    this.heartbeatTimer = setInterval(() => {
      const status: ViberStatus = {
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        runningTasks: this.runningTasks.size,
      };

      this.send({ type: "heartbeat", status });
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ==================== Reconnection ====================

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    const interval = this.config.reconnectInterval || 5000;
    console.log(`[Viber] Reconnecting in ${interval}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, interval);
  }
}
