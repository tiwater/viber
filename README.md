<img src="https://raw.githubusercontent.com/tiwater/viber/main/docs/src/assets/logo.png" alt="Viber Logo" width="100" />

# @tiwater/viber

**Extensible app runtime for AI coding workflows**

Viber is a runtime that hosts and manages apps. It provides:

- 🔌 **Plugin Architecture** - Simple app registration and lifecycle management
- 📡 **Command Center Integration** - Connect apps to remote task servers
- 🛠️ **Developer Tools** - CLI for local development and testing

## Quick Start

```bash
npx @tiwater/viber start
```

## Installation

```bash
npm install -g @tiwater/viber
```

## Usage

```bash
# Run all registered apps locally
viber start

# Connect to a command center
viber start --server wss://your-server.com --token YOUR_TOKEN

# Disable specific apps
viber start --disable-app <app-name>
```

## Building Apps

Apps are simple modules that export an `activate` function:

```typescript
// src/apps/my-app/index.ts
import type { ViberApp, ViberAppContext } from '@tiwater/viber';

const myApp: ViberApp = {
  name: 'my-app',
  version: '1.0.0',
  
  activate(context: ViberAppContext) {
    return {
      start: async () => {
        console.log('App started!');
        // Your app logic here
      },
      stop: async () => {
        console.log('App stopped!');
      }
    };
  }
};

export default myApp;
```

Register your app in `src/apps/index.ts`:

```typescript
import myApp from './my-app';
registerApp(myApp);
```

## Example: Antigravity Auto-Healing

The `antigravity-healing` app demonstrates how to build a viber app. It monitors Antigravity IDE windows and automatically recovers from errors.

**Setup:** Start Antigravity with CDP enabled:
```bash
open -a Antigravity --args --remote-debugging-port=9333
```

**Run:**
```bash
viber start
```

See [src/apps/antigravity-healing](./src/apps/antigravity-healing) for the full implementation.

## Documentation

See the [docs](./docs) folder for full documentation.

## License

MIT
