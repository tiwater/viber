---
title: "Tool Architecture & Execution"
---


## 1. Overview and Core Principles

The tool architecture is a cornerstone of the Viber framework, designed to safely provide agents with the capabilities they need to perform meaningful work. It directly supports the Vibe-X philosophy by enabling a secure, observable, and extensible system where a human expert can confidently delegate tasks to an AI partner.

The core principles are:

- **Security First**: Untrusted, LLM-generated code or commands must never execute directly on a host machine. All tool execution is centralized, validated, and sandboxed.
- **Robust Self-Correction**: LLM-generated tool calls can be malformed. The system is designed to detect this, provide clear, corrective feedback to the agent, and enable the agent to fix its own mistakes.
- **Extensible by Design**: The framework is built to be easily extended. Adding new tools follows a consistent pattern, and the architecture supports advanced integrations like the Model Context Protocol (MCP).

## 2. Tool Definition and Registration

A "tool" is a capability that an agent can call. Tools are defined using the AI SDK pattern with Zod schemas.

### 2.1. Tool Definition

Tools are defined with a name, description, parameter schema, and execute function:

```typescript
import { z } from "zod";
import type { CoreTool } from "@dustland/viber";

const writeFileTool: CoreTool = {
  name: "write_file",
  description: "Writes content to a file at the specified path.",
  parameters: z.object({
    path: z.string().describe("The file path to write to"),
    content: z.string().describe("The content to write"),
  }),
  execute: async ({ path, content }) => {
    // Implementation
    return { success: true, message: `File '${path}' written successfully.` };
  },
};
```

### 2.2. Tool Registration

Tools are registered with agents through configuration:

```typescript
import { Agent } from "@dustland/viber";

const agent = new Agent({
  name: "Developer",
  llm: { provider: "openai", model: "gpt-4o" },
  tools: ["write_file", "read_file", "execute_code"],
  requireApproval: ["write_file", "execute_code"], // Human-in-the-loop
});
```

## 3. The Tool Call Lifecycle

The following diagram and steps describe the end-to-end flow of a tool call, from the XAgent's task assignment to the final result.

```mermaid
graph TD
    XAgent -- "1. Assign Task" --> Agent

    subgraph "Agent"
        AgentLLM["LLM"]
        AgentCore["Core Logic"]
    end

    subgraph "Framework"
        ToolManager["Tool Manager"]
    end

    subgraph "Execution Environment"
        Tool["Tool (e.g., write_file)"]
    end

    AgentLLM -- "2. Generate Tool Call" --> AgentCore
    AgentCore -- "3. Request Execution" --> ToolManager

    alt 4a. Validation Fails
        ToolManager -- "Validation Error" --> AgentCore
        AgentCore -- "Error Context" --> AgentLLM
        AgentLLM -- "Corrected Tool Call" --> AgentCore
        AgentCore -- "Retry Request" --> ToolManager
    end

    ToolManager -- "4b. Validation Succeeds" --> Tool
    Tool -- "5. Return Result" --> ToolManager
    ToolManager -- "6. Return Structured Result" --> AgentCore
    AgentCore -- "7. Report Task Completion" --> XAgent
```

**Step-by-Step Flow:**

1. **Task Assignment (`XAgent`)**: The process begins when the `XAgent`, following the project's plan, assigns a specific task to a specialist `Agent` (e.g., "Write 'hello world' to `hello.txt`").

2. **Tool Call Generation (`Agent`'s LLM)**: The Agent's LLM receives the instruction. It determines that the task can be accomplished with a tool and generates the corresponding structured tool call.

3. **Execution Request**: The Agent's core logic receives the generated tool call and passes it to the Tool Manager for secure execution.

4. **Validation**: The Tool Manager validates the call against the tool's registered schema.

   - **If Validation Fails**: The Tool Manager returns a structured error to the Agent. The Agent's LLM receives the error context and generates a corrected call. This self-correction loop is a key feature of the framework's robustness.
   - **If Validation Succeeds**: The Tool Manager proceeds to execution.

5. **Secure Execution**: The Tool Manager securely runs the tool with validated parameters.

6. **Result Capturing**: The Tool Manager captures the tool's output and packages it into a structured result object, which is returned to the Agent.

7. **Task Completion**: The Agent has now completed its assigned task. It reports the result back to the XAgent, which updates the project plan and proceeds to the next step in the workflow.

## 4. Human-in-the-Loop Tool Approval

Viber supports native tool approval through AI SDK v6's approval mechanism:

```typescript
// Agent configuration with approval requirements
const agent = new Agent({
  name: "Developer",
  tools: ["write_file", "execute_code", "read_file"],
  requireApproval: ["write_file", "execute_code"],
});

// Frontend handles approval
const { messages, approveToolCall, status } = useXChat({
  spaceId: "my-space",
});

// When status is "awaiting-approval"
if (status === "awaiting-approval") {
  const pendingApprovals = getPendingApprovals(messages[messages.length - 1]);
  // Show UI for approval
  await approveToolCall(pendingApprovals[0].toolCallId, true);
}
```

## 5. Security Architecture

Executing arbitrary, LLM-generated commands is a major security risk. Viber mitigates this through multiple layers:

### Space-Scoped Execution

All tool executions are scoped to the Space's workspace directory:

- Tools can only read from and write to the Space's artifact directory
- Path traversal attacks are mitigated by resolving all paths relative to the Space root
- Each Space has complete data isolation from other Spaces

### Tool Permissions

```typescript
// Tools can specify their permission requirements
const webBrowseTool: CoreTool = {
  name: "browse_web",
  description: "Browse a webpage and extract content",
  parameters: z.object({
    url: z.string().url(),
  }),
  permissions: ["network"], // Requires network access
  execute: async ({ url }) => {
    // Implementation with Playwright
  },
};
```

## 6. Built-in Tools

Viber provides these tool categories:

| Tool ID    | Functions                                        | Category |
| ---------- | ------------------------------------------------ | -------- |
| `file`     | `createFile`, `readFile`, `deleteFile`, `listFiles`, `moveFile`, `copyFile` | File     |
| `search`   | `search` (Tavily/Serper)                         | Search   |
| `web`      | `fetchWebpage`, `crawlWebsite`, `checkUrl`       | Web      |
| `browser`  | `navigate`, `click`, `type`, `screenshot`        | Browser  |
| `desktop`  | `captureScreen`, `clickAt`, `typeText`           | Desktop  |

## 7. Custom Tools

Users can define custom tools following the same pattern:

```typescript
import { z } from "zod";
import type { CoreTool } from "@dustland/viber";

export const customTool: CoreTool = {
  name: "my_custom_tool",
  description: "Does something custom",
  parameters: z.object({
    input: z.string(),
  }),
  execute: async ({ input }) => {
    // Custom implementation
    return { result: `Processed: ${input}` };
  },
};

// Register with agent
const agent = new Agent({
  name: "CustomAgent",
  tools: [customTool], // Pass tool object directly
});
```

## 8. MCP Integration

Viber supports the Model Context Protocol (MCP) for integrating external tool servers. MCP servers are configured via the data adapter:

```typescript
// MCP tools are loaded automatically from configured servers
const agent = new Agent({
  name: "MCPAgent",
  tools: ["mcp:github", "mcp:supabase"],  // Reference by server ID
});
```

This enables agents to access external capabilities like GitHub, Supabase, and other MCP-compatible services.
