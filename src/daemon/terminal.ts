/**
 * Terminal streaming module - pipe tmux panes to WebSocket
 *
 * Provides:
 * - List tmux sessions/windows/panes
 * - Attach to a pane (start streaming output)
 * - Send input to a pane
 * - Detach from a pane (stop streaming)
 */

import { spawn, execSync, ChildProcess } from "child_process";
import { EventEmitter } from "events";

export interface TmuxPane {
  session: string;
  window: string;
  windowName: string;
  pane: string;
  command: string;
  target: string; // e.g. "coding:1.0"
}

export interface TmuxSession {
  name: string;
  windows: number;
  attached: boolean;
}

/**
 * List all tmux sessions
 */
export function listSessions(): TmuxSession[] {
  try {
    const out = execSync(
      "tmux list-sessions -F '#{session_name}|#{session_windows}|#{session_attached}' 2>/dev/null",
      { encoding: "utf8", stdio: "pipe" }
    ).trim();
    if (!out) return [];
    return out.split("\n").map((line) => {
      const [name, windows, attached] = line.split("|");
      return {
        name,
        windows: parseInt(windows, 10) || 0,
        attached: attached === "1",
      };
    });
  } catch {
    return [];
  }
}

/**
 * List all panes across all sessions
 */
export function listPanes(): TmuxPane[] {
  try {
    const out = execSync(
      "tmux list-panes -a -F '#{session_name}|#{window_index}|#{window_name}|#{pane_index}|#{pane_current_command}' 2>/dev/null",
      { encoding: "utf8", stdio: "pipe" }
    ).trim();
    if (!out) return [];
    return out.split("\n").map((line) => {
      const [session, window, windowName, pane, command] = line.split("|");
      return {
        session,
        window,
        windowName,
        pane,
        command,
        target: `${session}:${window}.${pane}`,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Send keys to a tmux target
 */
export function sendKeys(target: string, keys: string, pressEnter = false): boolean {
  try {
    const args = ["send-keys", "-t", target, keys];
    if (pressEnter) args.push("Enter");
    execSync(`tmux ${args.map((a) => `'${a}'`).join(" ")}`, {
      encoding: "utf8",
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Capture current pane content (snapshot)
 * Uses -J to join wrapped lines for cleaner output
 */
export function capturePane(target: string, lines = 500): string {
  try {
    return execSync(`tmux capture-pane -t '${target}' -p -J -S -${lines}`, {
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch {
    return "";
  }
}

/**
 * TerminalStream - streams a tmux pane's output
 *
 * Uses `tmux pipe-pane` to pipe output to a subprocess that we read from.
 * Emits 'data' events with the output chunks.
 */
export class TerminalStream extends EventEmitter {
  private target: string;
  private catProcess: ChildProcess | null = null;
  private pipePath: string;
  private isAttached = false;

  constructor(target: string) {
    super();
    this.target = target;
    // Use a unique pipe path per target
    this.pipePath = `/tmp/viber-term-${target.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}`;
  }

  /**
   * Start streaming the pane output
   */
  async attach(): Promise<boolean> {
    if (this.isAttached) return true;

    try {
      // First, capture existing content (history)
      const history = capturePane(this.target, 200);
      if (history) {
        this.emit("data", history);
      }

      // Create named pipe
      execSync(`mkfifo '${this.pipePath}' 2>/dev/null || true`, { stdio: "pipe" });

      // Start cat process to read from the pipe
      this.catProcess = spawn("cat", [this.pipePath], {
        stdio: ["ignore", "pipe", "ignore"],
      });

      this.catProcess.stdout?.on("data", (chunk: Buffer) => {
        this.emit("data", chunk.toString());
      });

      this.catProcess.on("close", () => {
        this.cleanup();
      });

      this.catProcess.on("error", (err) => {
        this.emit("error", err);
        this.cleanup();
      });

      // Tell tmux to pipe the pane output to our named pipe
      execSync(`tmux pipe-pane -t '${this.target}' -o 'cat >> ${this.pipePath}'`, {
        encoding: "utf8",
        stdio: "pipe",
      });

      this.isAttached = true;
      return true;
    } catch (err) {
      this.emit("error", err);
      this.cleanup();
      return false;
    }
  }

  /**
   * Stop streaming
   */
  detach(): void {
    if (!this.isAttached) return;

    try {
      // Stop tmux pipe
      execSync(`tmux pipe-pane -t '${this.target}'`, { stdio: "pipe" });
    } catch {
      // Ignore errors
    }

    this.cleanup();
  }

  /**
   * Send input to the pane
   */
  sendInput(keys: string): boolean {
    return sendKeys(this.target, keys, false);
  }

  private cleanup(): void {
    this.isAttached = false;

    if (this.catProcess) {
      this.catProcess.kill();
      this.catProcess = null;
    }

    try {
      execSync(`rm -f '${this.pipePath}'`, { stdio: "pipe" });
    } catch {
      // Ignore
    }

    this.emit("close");
  }

  get attached(): boolean {
    return this.isAttached;
  }
}

/**
 * TerminalManager - manages multiple terminal streams
 */
export class TerminalManager {
  private streams: Map<string, TerminalStream> = new Map();

  /**
   * List all available terminals
   */
  list(): { sessions: TmuxSession[]; panes: TmuxPane[] } {
    return {
      sessions: listSessions(),
      panes: listPanes(),
    };
  }

  /**
   * Attach to a pane and return the stream
   */
  async attach(
    target: string,
    onData: (data: string) => void,
    onClose: () => void
  ): Promise<boolean> {
    // If already attached, just add listeners
    let stream = this.streams.get(target);
    if (stream && stream.attached) {
      stream.on("data", onData);
      stream.on("close", onClose);
      return true;
    }

    // Create new stream
    stream = new TerminalStream(target);
    stream.on("data", onData);
    stream.on("close", () => {
      this.streams.delete(target);
      onClose();
    });

    const ok = await stream.attach();
    if (ok) {
      this.streams.set(target, stream);
    }
    return ok;
  }

  /**
   * Detach from a pane
   */
  detach(target: string): void {
    const stream = this.streams.get(target);
    if (stream) {
      stream.detach();
      this.streams.delete(target);
    }
  }

  /**
   * Send input to a pane
   */
  sendInput(target: string, keys: string): boolean {
    // Can send input even without a stream attached
    return sendKeys(target, keys, false);
  }

  /**
   * Detach all streams
   */
  detachAll(): void {
    for (const stream of this.streams.values()) {
      stream.detach();
    }
    this.streams.clear();
  }
}
