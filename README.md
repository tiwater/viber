<img src="https://raw.githubusercontent.com/tiwater/viber/main/docs/src/assets/logo.png" alt="Viber Logo" width="100" />

# Viber

**The AI worker that keeps vibing.**

Runs on your machine. Connects to your tools. Gets things done while you focus on the flow.

## Quick Start

```bash
npx @tiwater/viber
```

That's it. It starts, it connects, it vibes.

## How it works

Viber isn't just a script. It's a runtime for agentic capabilities.

### 🧠 Skills
The fundamental building blocks. Viber knows how to **control browsers**, **read files**, **connect via CDP**, and **listen to events**.

### ⚡️ Apps
The logic that puts skills to work. Apps are small, focused agents that solve specific problems.

## Built-in Magic

### 🩹 Antigravity Healing
Coding with Antigravity? Viber watches over your shoulder.
- **Monitors** your IDE for crashes (like "Agent terminated")
- **Fixes** them automatically by clicking Retry
- **Keeps** you in the flow without interruptions

*Requires Antigravity with `--remote-debugging-port=9333`*

## Do More

```bash
# Connect to Command Center (remote orchestration)
viber start --server wss://supen.app/vibers/ws --token YOUR_TOKEN

# Run only specific apps
viber start --disable-app antigravity-healing
```

## Creae Your Own

Viber is extensible. Write a simple app to automate your own workflow:

```typescript
const myApp: ViberApp = {
  name: 'daily-report',
  activate(context) {
    return {
      start: async () => {
        // Use skills to do cool stuff
        console.log("Vibing...");
      }
    };
  }
};
```

## License

MIT
