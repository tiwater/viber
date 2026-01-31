---
title: "Tmux-Based Terminal-Oriented AI Coding"
description: Two features—chat with viber (orchestration) and terminal observe/interact (pipe terminals to web)—that work together for development work.
---

## The Developer Issue

For developers, **chat alone is not enough**. Chat is good for simple tasks and orchestration, but **development work** requires **real terminals**: see live output, run commands, interact with Cursor Agent / Codex CLI / dev servers. That’s the main gap in chat-first assistants (e.g. Clawdbot for developers): everything is ask-and-response, so you can’t **observe and verify** in the same place you orchestrate.

Viber should support **two features** that work together:

| Feature                            | Purpose                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Chat with viber**             | Ask-and-response: orchestration, simple tasks, “set up coding session”, “open 3 Cursor Agent”, “run this”. Good for **simplifying** work.                                                                           |
| **2. Terminal observe + interact** | **Pipe terminals directly to the web**: stream tmux pane output to the cockpit and send input (keys/commands) from the cockpit to a pane. Good for **verifying results** and doing real development in the browser. |

**Together**: Use chat to simplify (create layout, run one-off commands); use the **terminal view** in the cockpit to watch output and type into Cursor/Codex/dev servers. No need to leave the cockpit to attach to tmux locally—terminals are **in the web**.

---

## Feature 1: Chat with Viber (current)

- **Protocol**: `task:submit` (goal + messages) → daemon runs agent (tmux skill, etc.) → `task:completed` (result).
- **Use**: Orchestration (“set up my coding session: 3 Cursor Agent, 2 Codex, 2 dev servers”), simple tasks (“run tests in pane 2”), list layout (“what’s my tmux layout?”).
- **Limitation**: You only get a **text result**. You don’t see live terminal output or type into panes from the cockpit.

---

## Feature 2: Terminal Observe + Interact (to add)

**Goal**: Pipe tmux panes **to the web** so the developer can:

- **Observe** — see live output from a tmux pane (e.g. Cursor Agent stream, dev server logs) in the cockpit.
- **Interact** — send keystrokes/commands from the cockpit to that pane (type in the terminal, run commands).

Then chat and terminal work together: **chat** to simplify (create session, open windows); **terminal view** to verify (watch the agent, run dev server, type in Codex).

### Protocol (outline)

- **terminal:list** — cockpit asks viber for list of tmux sessions/windows/panes (or “terminal slots”). Viber returns e.g. `[{ session, window, pane, name? }]`.
- **terminal:attach** (or **terminal:stream**) — cockpit says “stream pane `coding:1.0`”. Daemon starts streaming that pane’s output to the cockpit (over the same WebSocket or a dedicated channel) and accepts **terminal:input** (keys or paste) from the cockpit, which the daemon forwards to the pane (e.g. `tmux send-keys`).
- **terminal:detach** — cockpit says “stop streaming this pane”. Daemon stops piping and closes the pipe.

**Daemon side**: For each attached pane, the daemon must **capture output** (e.g. `tmux pipe-pane -t target -o 'cat'` or a small process that reads from the pane and writes to the WS) and **send input** (on `terminal:input`, run `tmux send-keys -t target <keys>`). This is **stateful per attachment** (one pipe per attached pane) but not “conversation state”—it’s a live I/O bridge.

**Cockpit side**: A **terminal UI** component (e.g. xterm.js or similar) that (1) subscribes to a pane (sends `terminal:attach`), (2) renders incoming output, (3) sends user keystrokes/paste as `terminal:input`. Multiple tabs or panes in the cockpit can map to multiple tmux panes.

### Architecture fit

- **Chat** remains stateless (task in → result out).
- **Terminal streaming** is a **separate capability** on the same WebSocket: message types `terminal:list`, `terminal:attach`, `terminal:output` (daemon → cockpit), `terminal:input` (cockpit → daemon), `terminal:detach`. The daemon keeps a small amount of state per **attached** pane (the pipe process), not per conversation.
- Both features can be used in the same session: open a terminal view to pane 1 (Cursor Agent), chat “run tests in pane 2”, then watch pane 2 in another terminal view.

---

## Tmux as General Skill (layout management)

The **tmux** skill (session/window/pane tools) supports **Feature 1**: create layout, open windows, send one-off commands. It does **not** by itself pipe output to the cockpit—that’s **Feature 2** (terminal streaming), which uses tmux on the daemon (e.g. `pipe-pane`, `send-keys`) as an implementation detail.

Conventions:

- **Session**: e.g. `coding`.
- **Windows**: `cursor-1`, `cursor-2`, `codex-a`, `codex-b`, `dev-1`, `dev-2`.
- **Attach locally**: `tmux attach -t coding` (optional; cockpit can show the same panes via Feature 2).

---

## Summary

| Feature                         | What                                                    | Protocol / implementation                                                                                                                      |
| ------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chat with viber**             | Ask-and-response; orchestration and simple tasks.       | Existing: `task:submit` → `task:completed`.                                                                                                    |
| **Terminal observe + interact** | Pipe tmux panes to the web; observe output, send input. | New: `terminal:list`, `terminal:attach`, `terminal:output`, `terminal:input`, `terminal:detach`. Daemon: pipe pane → WS; cockpit: terminal UI. |
| **Together**                    | Chat simplifies; terminal view verifies.                | Use both in the same cockpit session.                                                                                                          |

This addresses the “Clawdbot for developers” gap: developers get **real terminals in the web**, not only ask-and-response, while keeping chat for what it’s good at.

---

## Future: GUI Streaming

The same architecture can support **GUI streaming** (e.g. Office UI, desktop apps, browser windows) later:

- **Protocol**: `gui:list`, `gui:attach`, `gui:frame` (video/image stream), `gui:input` (mouse/keyboard), `gui:detach`. Same pattern as terminal streaming.
- **Daemon**: Capture screen region or window (e.g. via desktop tools, VNC-like, or browser CDP) and stream frames to the cockpit; forward input events to the OS or app.
- **Cockpit**: Render frames in a canvas; send mouse/keyboard events as `gui:input`.

This is not needed now but fits the architecture: **chat** for orchestration + **stream** (terminal or GUI) for observe/interact. Different stream types are just different message namespaces (`terminal:*`, `gui:*`) on the same WebSocket.
