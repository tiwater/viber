<img src="https://raw.githubusercontent.com/tiwater/viber/main/docs/src/assets/logo.png" alt="Viber Logo" width="100" />

# @tiwater/viber

**CLI tool for autonomous AI coding workflows**

Viber runs apps that enhance your AI coding experience. Currently includes:

- � **Auto-Healing** - Automatically recovers from Antigravity IDE errors
- � **Command Center** - Connect to remote task servers
- � **Plugin Architecture** - Extensible app system

## Quick Start

**Prerequisites:** Start Antigravity with CDP enabled:
```bash
open -a Antigravity --args --remote-debugging-port=9333
```

**Run viber:**
```bash
# No install needed
npx @tiwater/viber start
```

That's it! Viber will automatically heal any "Agent terminated" errors in Antigravity.

## Installation

```bash
npm install -g @tiwater/viber
```

## Usage

```bash
# Start in local mode (run all apps)
viber start

# Connect to a remote command center
viber start --server wss://your-server.com --token YOUR_TOKEN

# Disable specific apps
viber start --disable-app antigravity-healing

# Disable all apps (just connect to server)
viber start --no-apps
```

## Apps

| App | Description |
|-----|-------------|
| `antigravity-healing` | Monitors Antigravity windows and auto-clicks Retry on errors |

Apps are auto-loaded by default. Use `--disable-app <name>` to exclude specific apps.

## How Auto-Healing Works

1. Connects to Antigravity via Chrome DevTools Protocol (CDP)
2. Monitors all webview windows for error states
3. Detects "Agent terminated" or similar errors in the iframe
4. Automatically clicks the Retry button to recover
5. Logs all healing actions for visibility

## Documentation

See the [docs](./docs) folder for full documentation.

## License

MIT
