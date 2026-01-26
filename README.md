<img src="https://raw.githubusercontent.com/tiwater/viber/main/docs/src/assets/logo.png" alt="Viber Logo" width="100" />

# @tiwater/viber

**Agent Framework for Vibe-working**

Viber is a flexible multi-agent AI framework with built-in desktop automation. It provides:

- 🤖 **Agent System** - Define and orchestrate multiple AI agents
- 🛠️ **Tool Framework** - Decorator-based tool definitions with Zod schemas
- 📦 **Space Management** - Organize conversations, artifacts, and tasks
- 🔄 **State Management** - Zustand-based reactive state
- 🩹 **Auto-Healing** - Automatically recover from Antigravity IDE errors
- 🎯 **Framework Agnostic** - Works with React, Svelte, or vanilla JS

## Quick Start

```bash
# Auto-heal Antigravity errors (no install needed)
npx @tiwater/viber monitor
```

## Installation

```bash
# Install globally for easier access
npm install -g @tiwater/viber
viber --help
```

## CLI Commands

### Auto-Healing (Antigravity Monitor)

Automatically detects and recovers from "Agent terminated" errors in Antigravity IDE:

```bash
# Start the monitor (requires Antigravity to run with --remote-debugging-port=9333)
viber monitor

# Options
viber monitor --interval 5000        # Check every 5 seconds
viber monitor --cdp-port 9222        # Use different CDP port
viber monitor --max-retries 5        # Max retries before alerting
```

### Full Daemon Mode

Connect to command center with all apps enabled:

```bash
# Start daemon with auto-healing
viber start --token YOUR_TOKEN

# Disable specific apps
viber start --token YOUR_TOKEN --disable-app antigravity-healing

# Disable all apps
viber start --token YOUR_TOKEN --no-apps
```

### Run Tasks Locally

```bash
viber run "Create a hello world app"
viber run "Fix the bug in main.ts" --workspace ./my-project
```

## Programmatic Usage

```typescript
import { Agent, Space, streamText } from '@tiwater/viber';

// Create an agent
const agent = new Agent({
  name: 'Assistant',
  model: 'openai:gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
});

// Stream a response
const result = await agent.streamText({
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Apps

Viber includes built-in apps that extend functionality:

| App | Description |
|-----|-------------|
| `antigravity-healing` | Auto-detects and recovers from Antigravity IDE errors |

Apps are auto-loaded when running `viber start`. Use `--disable-app` to exclude specific apps.

## Documentation

See the [docs](./docs) folder for full documentation and examples.

## License

MIT
