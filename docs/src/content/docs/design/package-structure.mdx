---
title: "Package Structure & Exports"
description: "Understanding Viber's single-package architecture and modular exports"
---

## Package Overview

**Viber** is distributed as a **single unified package** (`@dustland/viber`) for maximum simplicity. All core functionality is available through a single import.

```bash
npm install @dustland/viber
```

```typescript
import { 
  ViberAgent, 
  Agent, 
  Space,
  streamText,
  generateText 
} from "@dustland/viber";
```

## Internal Architecture

While distributed as one package, Viber is organized into clear subsystems:

```
src/
├── core/           # Agent, ViberAgent, Space, Task, Plan
├── daemon/         # Scheduler, cron jobs, background workers
├── channels/       # DingTalk, WeCom, Telegram integrations
├── skills/         # Skill registry and domain-specific modules
├── tools/          # File, Browser, Search, Web, Desktop tools
├── data/           # DataAdapter interface and implementations
├── storage/        # SpaceStorage for artifacts and files
├── state/          # Zustand-based state management
└── server/         # HTTP API endpoints
```

## Core Exports

### Agents

```typescript
import { ViberAgent, Agent } from "@dustland/viber";

// ViberAgent: Full-featured agent with conversation management
const viber = new ViberAgent({
  name: "Assistant",
  provider: "openai",
  model: "gpt-4o",
  tools: ["file", "browser"],
});

// Agent: Lightweight specialist agent
const researcher = new Agent({
  name: "Researcher",
  systemPrompt: "You are a research specialist",
});
```

### Space & Storage

```typescript
import { SpaceManager, SpaceStorageFactory } from "@dustland/viber";

// Access space data
const space = await SpaceManager.getSpace(spaceId);

// Direct storage access
const storage = await SpaceStorageFactory.create(spaceId);
await storage.writeFile("notes.md", content);
```

### AI SDK Integration

Viber re-exports key AI SDK v6 functions:

```typescript
import { 
  streamText, 
  generateText, 
  Output 
} from "@dustland/viber";

// Use directly with Viber agents
const result = await viber.generateText({
  messages: [{ role: "user", content: "Hello" }]
});
```

## Data Adapters

Storage is abstracted through adapters:

| Adapter | Structured Data | Files | Use Case |
|---------|-----------------|-------|----------|
| `LocalAdapter` | JSON files | Filesystem | Development, CLI |
| `SupabaseAdapter` | PostgreSQL | Supabase Storage | Production, multi-user |

Adapters are selected automatically based on environment:

```typescript
import { getServerDataAdapter } from "@dustland/viber";

// Returns LocalAdapter or SupabaseAdapter based on config
const adapter = getServerDataAdapter();
```

## CLI

Viber includes a CLI for daemon management:

```bash
# Run Viber daemon (hot-reload in dev)
pnpm dev

# Production
viber start
viber stop
```

## Key Concepts

### Hierarchy

```
Space (persistent container)
  └── Mission (user's goal)
        └── Plan (evolving strategy)
              └── Task[] (work items)
```

### Design Principles

- **Single Package**: No fragmented `@viber/*` dependencies
- **Built-in Adapters**: Local and Supabase storage included
- **AI SDK v6**: Full compatibility with Vercel AI SDK
- **Modular Tools**: Enable only what you need
