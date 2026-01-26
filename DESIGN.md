# Viber 2.0 Technical Design Specification

## 1. System Architecture

Viber 2.0 moves from a standalone local runtime to a **Desktop Mesh** architecture. This allows multiple specialized agents to run locally while being controlled via pluggable **Command Center Adapters**.

### 1.1. Core Components
*   **Viber Runtime (Node):** The local process hosting the Agent Mesh.
*   **Agent Mesh:** A registry of active `Agent` instances (e.g., Coder, Triage, Browser) that can communicate via an internal event bus.
*   **Command Center Adapters:** Pluggable modules that bridge the internal event bus to external interfaces (CLI, WebSocket, Slack).
*   **Skill Registry:** A file-system watcher that indexes `SKILL.md` files and exposes them as executable tools.

## 2. Technical Specifications

### 2.1. Skill Definition (`SKILL.md`)

Capabilities are defined in `SKILL.md` files. These files are parsed at runtime to generate tool definitions for the LLM.

**File Format:**
```markdown
---
name: <kebab-case-name>
description: <Description for the LLM>
parameters:
  <param_name>:
    type: string | number | boolean
    description: <Description of the parameter>
    required: true | false
---

# Procedure
<Executable script or natural language instructions>
```

**Example (`src/skills/git/commit.skill.md`):**
```markdown
---
name: git-commit
description: Stage changes and commit with a message.
parameters:
  message:
    type: string
    description: The commit message
    required: true
---
git add .
git commit -m "$message"
```

### 2.2. Command Center Adapter Interface

Adapters must implement the following TypeScript interface to facilitate full-duplex communication.

```typescript
export interface CommandCenterAdapter {
  /**
   * Unique identifier for the adapter (e.g., 'cli', 'websocket-gateway')
   */
  id: string;

  /**
   * Called when the runtime starts.
   * @param callbacks - Hooks to inject events into the runtime.
   */
  connect(callbacks: {
    onMessage: (message: UserMessage) => void;
    onInterrupt: (signal: InterruptSignal) => void;
  }): Promise<void>;

  /**
   * Stream a chunk of data from an agent to the command center.
   */
  stream(event: AgentStreamEvent): Promise<void>;
}

export type AgentStreamEvent =
  | { type: 'text-delta'; content: string; agentId: string }
  | { type: 'tool-call'; tool: string; args: unknown; agentId: string }
  | { type: 'tool-result'; tool: string; result: unknown; agentId: string }
  | { type: 'state-change'; state: AgentState; agentId: string };
```

### 2.3. Agentic Composite Procedures

Complex workflows are defined as "Playbooks" in Markdown. Unlike rigid scripts, these are read by a "Supervisor Agent" which plans execution.

**Format:**
```markdown
# Playbook: <Name>

## Goal
<High-level objective>

## Steps
1. [Agent: <AgentName>] <Instruction>
2. [Agent: <AgentName>] <Instruction>
   - Constraint: <Constraint>
```

**Example:**
```markdown
# Playbook: release-feature

## Goal
Prepare a feature branch for release.

## Steps
1. [Coder] Run all tests and ensure they pass.
2. [Coder] Bump the version in package.json.
3. [Git] Create a new branch named `release/v<version>`.
4. [Git] Push the branch and open a PR.
```

### 2.4. Control Plane Protocol

Communication between the Runtime and Command Centers uses a standardized JSON-RPC-like protocol over the transport layer (handled by Adapters).

**User Message (Inbound):**
```json
{
  "id": "uuid",
  "content": "Fix the bug in src/api.ts",
  "attachments": [],
  "context": {
    "currentFile": "src/api.ts",
    "selection": "..."
  }
}
```

**Interruption Signal (Inbound):**
```json
{
  "type": "interrupt",
  "targetAgentId": "*", // or specific agent ID
  "reason": "User cancelled operation"
}
```

## 3. Implementation Plan

1.  **Phase 1: Skill Loader**
    *   Implement `SkillLoader` to parse `SKILL.md` frontmatter and body.
    *   Map `sh` blocks to `child_process.exec`.

2.  **Phase 2: Adapter System**
    *   Refactor `src/cli` to use the `CommandCenterAdapter` interface.
    *   Create `WebSocketAdapter` for remote interfaces.

3.  **Phase 3: Mesh Runtime**
    *   Implement the internal event bus.
    *   Refactor existing "Apps" into independent "Agents".
