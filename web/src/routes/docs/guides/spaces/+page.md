---
title: "Spaces"
description: Organize conversations, artifacts, and tasks
---

import { Aside } from "$lib/components/docs";

## Overview

Spaces provide isolated workspaces for organizing agent conversations, generated artifacts, and task history. Each space maintains its own context and state.

## Creating a Space

```typescript
import { Space } from "viber";

const space = new Space({
  name: "my-project",
  rootPath: "./workspaces/my-project",
});
```

## Space Structure

```
my-project/
  .viber/
    config.json
    history/
    artifacts/
  outputs/
```

## Configuration

```typescript
const space = new Space({
  name: "research-project",
  rootPath: "./workspaces/research",
  config: {
    maxHistoryItems: 100,
    autoSaveInterval: 5000,
  },
});
```

| Option             | Type     | Default  | Description             |
| ------------------ | -------- | -------- | ----------------------- |
| `name`             | `string` | required | Space identifier        |
| `rootPath`         | `string` | required | Filesystem path         |
| `maxHistoryItems`  | `number` | `1000`   | History retention limit |
| `autoSaveInterval` | `number` | `10000`  | Auto-save interval (ms) |

## Using Spaces with Agents

```typescript
const agent = new Agent({
  name: "Researcher",
  model: "openai:gpt-4o",
  space, // Associate with a space
});

// Artifacts are automatically saved to the space
await agent.streamText({
  messages: [{ role: "user", content: "Research AI trends" }],
});
```

## Accessing Artifacts

```typescript
// List all artifacts
const artifacts = await space.listArtifacts();

// Read a specific artifact
const content = await space.readArtifact("report.md");

// Save an artifact
await space.saveArtifact("summary.txt", "Key findings...");
```

<Aside type="tip">
  Spaces persist across sessions, enabling agents to resume work where they left off.
</Aside>

## Task History

```typescript
// View conversation history
const history = await space.getHistory();

// Clear history
await space.clearHistory();
```
