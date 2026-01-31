---
name: tmux
description: Install and use tmux for terminal multiplexing and running TTY-requiring CLIs from automation (e.g. Cursor agent, interactive tools).
---

# Tmux Skill

Tmux provides a persistent pseudo-terminal (PTY). When the user asks to use tmux or run commands in a terminal, use your available tools (their descriptions tell you when to call them). Many CLIs (e.g. Cursor `agent`, interactive REPLs) **require a TTY** and hang or fail when run directly from a script or subprocess. Running them inside tmux fixes this.

## Installation (manual)

Tmux must be installed on the system. Use one of the following.

**macOS (Homebrew):**

```bash
brew install tmux
```

**Ubuntu / Debian:**

```bash
sudo apt update && sudo apt install tmux
```

**Fedora / RHEL:**

```bash
sudo dnf install tmux
```

**Verify:** `tmux -V`

## Tools (use these from the agent)

- **tmux_install_check** — Check if tmux is installed; call before any other tmux tool.
- **tmux_new_session** — Create a detached session (e.g. `coding`). Optionally name the first window and set start directory.
- **tmux_new_window** — Create a new window in a session. Use to add Cursor Agent, Claude Code, Codex CLI, or dev server terminals. Optionally run a command in the new window.
- **tmux_split_pane** — Split a pane (horizontal or vertical). Use to add a dev server pane next to a coding window. Optionally run a command in the new pane.
- **tmux_send_keys** — Send keys or a command to a target: `session`, `session:window`, or `session:window.pane`.
- **tmux_list** — List sessions, or list windows/panes for a session. Use when the user asks "what is my tmux layout" or "list my terminals."
- **tmux_run** — Run one command in a session and return captured output (for TTY-requiring CLIs). Use when the user wants a single run and capture; for multi-terminal layouts use the tools above.

## Target format

- **Session:** `coding`
- **Window:** `coding:1` (index) or `coding:cursor-1` (name)
- **Pane:** `coding:1.0` (window 1, pane 0)

## Multi-terminal layout (e.g. AI coding)

When the user wants **multiple terminals** (e.g. 3× Cursor Agent, 3× Claude Code, 2× Codex CLI, 2× dev servers):

1. **tmux_install_check** — ensure tmux is installed.
2. **tmux_new_session** — create session (e.g. `coding`) with optional first window name.
3. **tmux_new_window** — for each Cursor/Claude/Codex/dev terminal: create a window (optionally named, e.g. `cursor-1`, `codex-a`) and optionally run a command (`agent`, `cd /path && npm run dev`).
4. **tmux_split_pane** — when the user wants a pane split (e.g. dev server next to a Cursor window).
5. **tmux_list** — to describe the layout or choose where to open the next window.

Convention: one session per "workspace" (e.g. `coding`), window names like `cursor-1`, `cursor-2`, `codex-a`, `codex-b`, `dev-1`. User attaches with `tmux attach -t coding`.

## Basic usage (single command + capture)

- **Create detached session:** `tmux new-session -d -s <name>`
- **Send keys:** `tmux send-keys -t <name> "command" Enter`
- **Capture pane output:** `tmux capture-pane -t <name> -p -S -200`
- **Kill session:** `tmux kill-session -t <name>`
- **Check if session exists:** `tmux has-session -t <name> 2>/dev/null`

For a single run-and-capture flow (e.g. one Cursor agent task), use **tmux_run**. The **cursor-agent** skill uses this pattern. For multi-terminal layouts, use **tmux_new_session**, **tmux_new_window**, **tmux_send_keys**, **tmux_list**.

## When to use

- Running Cursor CLI (`agent`) from viber or scripts → use tmux (or the cursor-agent skill).
- **Setting up many terminals** (Cursor Agent, Claude Code, Codex CLI, dev servers) → use tmux_new_session, tmux_new_window, tmux_split_pane, tmux_send_keys, tmux_list.
- Running any interactive CLI from automation → run it inside a tmux session.
- Do **not** run such CLIs with `child_process.exec` or `subprocess.run` without a PTY—they will hang.
