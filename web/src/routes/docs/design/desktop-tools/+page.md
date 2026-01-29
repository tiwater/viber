---
title: "Desktop Tools"
description: GUI automation and desktop control using UI-TARS for Viber agents
---

import { Aside } from "$lib/components/docs";

## Overview

_Experimental_

Desktop Tools enable Viber agents to interact with graphical user interfaces through **visual understanding and control**. Using the UI-TARS framework, agents can see the screen, understand UI elements, and perform mouse/keyboard actions like a human user.

<Aside type="tip">
  Desktop automation is ideal for tasks that require interacting with native applications, web browsers, or any GUI-based software.
</Aside>

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ViberAgent                                           │
│                                                                              │
│  Goal: "Create a presentation about AI agents"                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DesktopTool                                           │
│                                                                              │
│  @ToolFunction("desktop_execute")                                           │
│  @ToolFunction("desktop_screenshot")                                        │
│  @ToolFunction("desktop_click")                                             │
│  @ToolFunction("desktop_type")                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      UI-TARS SDK (@ui-tars/sdk)                              │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────────────────────┐ │
│  │   GUIAgent      │    │               Operators                         │ │
│  │   (Vision LLM)  │◄──►│  NutJSOperator (desktop)                        │ │
│  │                 │    │  WebOperator (browser)                          │ │
│  │                 │    │  MobileOperator (iOS/Android)                   │ │
│  └─────────────────┘    └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Desktop Environment                                     │
│                                                                              │
│  Screen Capture → Visual Understanding → Action Execution                   │
│                                                                              │
│  mouse.click(x, y) | keyboard.type("text") | scroll(direction)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Available Tools

### desktop_execute

Execute complex GUI tasks via natural language:

```typescript
@ToolFunction({
  name: "desktop_execute",
  description: "Execute a natural language command on the desktop GUI",
  input: z.object({
    instruction: z.string().describe("What to do"),
    maxSteps: z.number().optional().default(20),
  }),
})
```

**Example usage by agent:**

```
Agent calls: desktop_execute({ instruction: "Open Chrome and search for AI news" })
```

### desktop_screenshot

Capture the current screen state:

```typescript
@ToolFunction({
  name: "desktop_screenshot",
  description: "Capture a screenshot of the current desktop",
  input: z.object({
    saveTo: z.string().optional().describe("Filename in artifacts"),
  }),
})
```

### desktop_click

Click at specific coordinates:

```typescript
@ToolFunction({
  name: "desktop_click",
  description: "Click at specific screen coordinates",
  input: z.object({
    x: z.number(),
    y: z.number(),
    button: z.enum(["left", "right", "middle"]).optional(),
    doubleClick: z.boolean().optional(),
  }),
})
```

### desktop_type

Type text at current cursor position:

```typescript
@ToolFunction({
  name: "desktop_type",
  description: "Type text at the current cursor position",
  input: z.object({
    text: z.string(),
    pressEnter: z.boolean().optional(),
  }),
})
```

## Configuration

Desktop tools require a UI-TARS model endpoint:

```typescript
// Tool configuration
{
  modelBaseURL: "https://your-ui-tars-endpoint",
  modelApiKey: process.env.UI_TARS_API_KEY,
  modelName: "UI-TARS-1.5-7B",
}
```

**Environment variables:**

```bash
UI_TARS_BASE_URL=https://your-ui-tars-endpoint
UI_TARS_API_KEY=your-api-key
```

## Model Options

| Model             | Size   | Provider     | Best For         |
| ----------------- | ------ | ------------ | ---------------- |
| UI-TARS-1.5-7B    | 7B     | Hugging Face | Local deployment |
| Seed-1.5-VL       | Varies | ByteDance    | Cloud API        |
| Claude 3.5 Sonnet | -      | Anthropic    | General purpose  |

## Usage

### Enable Desktop Mode

```bash
# Start viber with desktop tools enabled
viber start --desktop
```

### In Agent Configuration

```yaml
# agents/desktop-assistant.yaml
id: desktop-assistant
name: Desktop Assistant
tools:
  - file
  - search
  - web
  - desktop # Enable desktop tools
```

## Execution Flow

When `desktop_execute` is called:

1. **Screenshot**: Capture current screen as base64 image
2. **Send to VLM**: UI-TARS model analyzes screen + instruction
3. **Predict Action**: Model returns action like `click(start_box='(27,496)')`
4. **Execute**: Operator performs the action (mouse click)
5. **Repeat**: Loop until task complete or max steps reached

```
┌──────────────────────────────────────────────────────────────────────┐
│  Loop until finished:                                                 │
│                                                                       │
│  screenshot() → model.invoke(screenshots, instruction) → execute()   │
│       ▲                                                       │      │
│       └───────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

## Security

<Aside type="caution">
  Desktop tools have full access to your screen and input devices. Only enable with trusted agents.
</Aside>

**Safety measures:**

- Requires explicit `--desktop` flag to enable
- Actions logged for audit trail
- Abort support via `AbortController`
- Max steps limit prevents infinite loops

## Limitations

| Limitation           | Description                                |
| -------------------- | ------------------------------------------ |
| **Model dependency** | Requires UI-TARS or compatible VLM         |
| **Platform support** | Currently macOS, Windows, Linux            |
| **Performance**      | Each step requires screenshot + model call |
| **Accuracy**         | VLM may misinterpret complex UIs           |

## Example: Full Desktop Task

```typescript
// Agent receives goal: "Create a slide about AI"
const result = await agent.streamText({
  messages: [
    { role: "user", content: "Create a slide about AI in PowerPoint" },
  ],
  tools: ["file", "desktop"],
});

// Agent's execution:
// 1. desktop_execute({ instruction: "Open PowerPoint" })
// 2. desktop_execute({ instruction: "Create a new presentation" })
// 3. desktop_execute({ instruction: "Add title: AI Agents Overview" })
// 4. desktop_execute({ instruction: "Add bullet points about AI capabilities" })
// 5. desktop_screenshot({ saveTo: "slide-preview.png" })
```
