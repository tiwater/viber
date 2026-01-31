import { z } from "zod";
import { execSync, spawnSync } from "child_process";
import * as path from "path";

const SAFE_RE = /[^a-zA-Z0-9_.:-]/g;

function safeTarget(t: string): string {
  return t.replace(SAFE_RE, "-");
}

/**
 * Run a command inside a tmux session and capture pane output.
 * Use for CLIs that require a TTY (e.g. Cursor agent, interactive REPLs).
 */
function runInTmux(
  sessionName: string,
  command: string,
  cwd: string,
  waitSeconds: number,
): string {
  const safeSession = sessionName.replace(SAFE_RE, "-");
  execSync(
    `tmux has-session -t ${safeSession} 2>/dev/null || tmux new-session -d -s ${safeSession}`,
    { encoding: "utf8", stdio: "pipe" },
  );

  const cdCmd = cwd.includes(" ")
    ? `cd "${cwd.replace(/"/g, '\\"')}"`
    : `cd ${cwd}`;
  spawnSync("tmux", ["send-keys", "-t", safeSession, cdCmd, "Enter"], {
    encoding: "utf8",
    stdio: "pipe",
  });

  spawnSync("tmux", ["send-keys", "-t", safeSession, command, "Enter"], {
    encoding: "utf8",
    stdio: "pipe",
  });

  execSync(`sleep ${Math.max(1, waitSeconds)}`, {
    encoding: "utf8",
    stdio: "pipe",
  });

  const out = execSync(`tmux capture-pane -t ${safeSession} -p -S -200`, {
    encoding: "utf8",
    stdio: "pipe",
  });
  return out;
}

export function getTools(): Record<string, import("../../core/tool").CoreTool> {
  return {
    tmux_install_check: {
      description:
        "Check if tmux is installed and return its version. Call when the user says 'use tmux' or before using any tmux_* tool; if not installed, tell the user to install (e.g. brew install tmux on macOS).",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("tmux -V", {
            encoding: "utf8",
            stdio: "pipe",
          });
          return { installed: true, version: out.trim() };
        } catch {
          return {
            installed: false,
            hint: "Install with: brew install tmux (macOS) or sudo apt install tmux (Ubuntu)",
          };
        }
      },
    },
    tmux_new_session: {
      description:
        "Create a new detached tmux session. Use when the user asks to set up a coding session or create a new tmux session. Optionally set the first window name and/or start directory.",
      inputSchema: z.object({
        sessionName: z.string().describe("Session name (e.g. 'coding')"),
        firstWindowName: z
          .string()
          .optional()
          .describe("Name for the first window (e.g. 'cursor-1')"),
        startDirectory: z
          .string()
          .optional()
          .describe("Working directory for the first window"),
      }),
      execute: async (args: {
        sessionName: string;
        firstWindowName?: string;
        startDirectory?: string;
      }) => {
        const target = safeTarget(args.sessionName);
        try {
          const cmd = ["new-session", "-d", "-s", target];
          if (args.firstWindowName) {
            cmd.push("-n", safeTarget(args.firstWindowName));
          }
          if (args.startDirectory) {
            cmd.push("-c", path.resolve(args.startDirectory));
          }
          execSync(`tmux ${cmd.map((c) => `'${c}'`).join(" ")}`, {
            encoding: "utf8",
            stdio: "pipe",
          });
          return {
            ok: true,
            sessionName: target,
            message: `Session '${target}' created. Attach with: tmux attach -t ${target}`,
          };
        } catch (err: any) {
          return { ok: false, error: err?.message || String(err), sessionName: target };
        }
      },
    },
    tmux_new_window: {
      description:
        "Create a new window in an existing tmux session. Use to add Cursor Agent, Claude Code, Codex CLI, or dev server terminals. Optionally set window name and command to run.",
      inputSchema: z.object({
        target: z
          .string()
          .describe(
            "Session name or session:window (e.g. 'coding' or 'coding:1'). New window is created in the session.",
          ),
        windowName: z
          .string()
          .optional()
          .describe("Name for the new window (e.g. 'cursor-2', 'codex-a')"),
        command: z
          .string()
          .optional()
          .describe(
            "Command to run in the new window (e.g. 'agent' or 'cd /path && npm run dev'). If omitted, just opens a shell.",
          ),
        cwd: z.string().optional().describe("Working directory for the new window"),
      }),
      execute: async (args: {
        target: string;
        windowName?: string;
        command?: string;
        cwd?: string;
      }) => {
        const sessionPart = args.target.split(":")[0];
        const session = safeTarget(sessionPart);
        try {
          const newWinArgs = ["new-window", "-t", session, "-d"];
          if (args.windowName) {
            newWinArgs.push("-n", safeTarget(args.windowName));
          }
          if (args.cwd) {
            newWinArgs.push("-c", path.resolve(args.cwd));
          }
          spawnSync("tmux", newWinArgs, { encoding: "utf8", stdio: "pipe" });
          if (args.command) {
            spawnSync("tmux", ["send-keys", "-t", session, args.command, "Enter"], {
              encoding: "utf8",
              stdio: "pipe",
            });
          }
          return {
            ok: true,
            session,
            windowName: args.windowName ?? "(new)",
            message: `New window created in session '${session}'. Attach with: tmux attach -t ${session}`,
          };
        } catch (err: any) {
          return { ok: false, error: err?.message || String(err), session };
        }
      },
    },
    tmux_split_pane: {
      description:
        "Split the current pane in a tmux window (horizontal or vertical). Use to add a dev server pane next to a Cursor window, or to run a command in a new pane.",
      inputSchema: z.object({
        target: z
          .string()
          .describe(
            "Session, session:window, or session:window.pane (e.g. 'coding:2' or 'coding:cursor-1')",
          ),
        vertical: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, split vertically (side by side); otherwise split horizontally"),
        command: z
          .string()
          .optional()
          .describe("Command to run in the new pane (e.g. 'npm run dev')"),
        cwd: z.string().optional().describe("Working directory for the new pane"),
      }),
      execute: async (args: {
        target: string;
        vertical?: boolean;
        command?: string;
        cwd?: string;
      }) => {
        const t = safeTarget(args.target);
        try {
          const splitArgs = ["split-window", "-t", t, "-d"];
          if (args.vertical) {
            splitArgs.push("-h");
          }
          if (args.cwd) {
            splitArgs.push("-c", path.resolve(args.cwd));
          }
          spawnSync("tmux", splitArgs, { encoding: "utf8", stdio: "pipe" });

          if (args.command) {
            spawnSync("tmux", ["send-keys", "-t", t, args.command, "Enter"], {
              encoding: "utf8",
              stdio: "pipe",
            });
          }
          return {
            ok: true,
            target: t,
            message: `Pane split in '${t}'. Attach with: tmux attach -t ${t.split(":")[0]}`,
          };
        } catch (err: any) {
          return { ok: false, error: err?.message || String(err), target: t };
        }
      },
    },
    tmux_send_keys: {
      description:
        "Send keys (or a command) to a specific tmux target: session, session:window, or session:window.pane. Use to run a command in an existing pane or to type into a specific terminal.",
      inputSchema: z.object({
        target: z
          .string()
          .describe(
            "Tmux target: session (e.g. 'coding'), session:window ('coding:1' or 'coding:cursor-1'), or session:window.pane ('coding:1.0')",
          ),
        keys: z
          .string()
          .describe(
            "Keys or command to send (e.g. 'npm run dev' or 'agent -p \"task\"'). Use 'Enter' for newline.",
          ),
        pressEnter: z
          .boolean()
          .optional()
          .default(true)
          .describe("If true, send Enter after the keys"),
      }),
      execute: async (args: { target: string; keys: string; pressEnter?: boolean }) => {
        const t = safeTarget(args.target);
        try {
          spawnSync("tmux", ["send-keys", "-t", t, args.keys, ...(args.pressEnter !== false ? ["Enter"] : [])], {
            encoding: "utf8",
            stdio: "pipe",
          });
          return { ok: true, target: t };
        } catch (err: any) {
          return { ok: false, error: err?.message || String(err), target: t };
        }
      },
    },
    tmux_list: {
      description:
        "List tmux sessions, or list windows and panes for a session. Use when the user asks 'what is my tmux layout' or 'list my terminals' so you can describe the layout or choose where to open the next window.",
      inputSchema: z.object({
        sessionName: z
          .string()
          .optional()
          .describe(
            "If provided, list windows and panes for this session; otherwise list all sessions",
          ),
      }),
      execute: async (args: { sessionName?: string }) => {
        try {
          if (args.sessionName) {
            const session = safeTarget(args.sessionName);
            const windows = execSync(`tmux list-windows -t ${session} -F '#{window_index} #{window_name}' 2>/dev/null || true`, {
              encoding: "utf8",
              stdio: "pipe",
            }).trim();
            const panes = execSync(`tmux list-panes -t ${session} -F '#{window_index}.#{pane_index} #{pane_current_command}' 2>/dev/null || true`, {
              encoding: "utf8",
              stdio: "pipe",
            }).trim();
            return {
              ok: true,
              session,
              windows: windows ? windows.split("\n") : [],
              panes: panes ? panes.split("\n") : [],
            };
          }
          const sessions = execSync("tmux list-sessions -F '#{session_name}' 2>/dev/null || true", {
            encoding: "utf8",
            stdio: "pipe",
          }).trim();
          return {
            ok: true,
            sessions: sessions ? sessions.split("\n") : [],
          };
        } catch (err: any) {
          return { ok: false, error: err?.message || String(err) };
        }
      },
    },
    tmux_run: {
      description:
        "Run a shell command inside a tmux session and return the pane output. Call when the user says 'use tmux' or asks to run a command in a terminal/tmux. Use for CLIs that require a TTY. Requires tmux installed (use tmux_install_check first).",
      inputSchema: z.object({
        sessionName: z
          .string()
          .describe("Tmux session name (e.g. 'cursor-agent' or 'mytask')"),
        command: z
          .string()
          .describe(
            'Full command to run (e.g. "agent -p \'Refactor this file\'" or "npm run dev")',
          ),
        cwd: z
          .string()
          .optional()
          .describe("Working directory (defaults to process cwd)"),
        waitSeconds: z
          .number()
          .optional()
          .default(15)
          .describe("Seconds to wait before capturing output"),
      }),
      execute: async (args: {
        sessionName: string;
        command: string;
        cwd?: string;
        waitSeconds?: number;
      }) => {
        const cwd = args.cwd ? path.resolve(args.cwd) : process.cwd();
        const waitSeconds = args.waitSeconds ?? 15;
        try {
          const output = runInTmux(
            args.sessionName,
            args.command,
            cwd,
            waitSeconds,
          );
          return { ok: true, output, cwd, sessionName: args.sessionName };
        } catch (err: any) {
          return {
            ok: false,
            error: err?.message || String(err),
            cwd,
            sessionName: args.sessionName,
          };
        }
      },
    },
  };
}
