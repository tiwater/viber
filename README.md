<img src="https://raw.githubusercontent.com/tiwater/viber/main/docs/src/assets/logo.png" alt="Viber Logo" width="100" />

# Viber

**Your local tools, supercharged.**

Background apps that connect, automate, and enhance your local development environment.

## Quick Start

```bash
npx @tiwater/viber start
```

That's it. Viber runs with all built-in apps enabled.

## What It Does

### Runs on Your Machine
Mac, Windows, or Linux. Private by default—your apps run locally.

### App Container
Manages app lifecycles. Start, stop, and monitor multiple apps at once.

### Built-in Apps
Comes with useful apps out of the box. Like auto-healing for Antigravity IDE.

### Extensible
Install community apps or build your own. Simple API, powerful capabilities.

### Command Center
Connect to remote servers to receive tasks and coordinate across machines.

## Usage

```bash
# Run locally with all apps
viber start

# Connect to a server
viber start --server wss://your-server.com --token TOKEN

# Disable specific apps
viber start --disable-app antigravity-healing
```

## Built-in Apps

| App | Description |
|-----|-------------|
| `antigravity-healing` | Auto-recovers Antigravity IDE from errors |

## Building Apps

```typescript
const myApp: ViberApp = {
  name: 'my-app',
  version: '1.0.0',
  
  activate(context) {
    return {
      start: async () => { /* your logic */ },
      stop: async () => { /* cleanup */ }
    };
  }
};
```

## License

MIT
