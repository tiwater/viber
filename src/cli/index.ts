#!/usr/bin/env node

/**
 * Viber CLI - Command line interface for the Viber framework
 *
 * Commands:
 *   viber start    - Start the viber daemon (connect to command center)
 *   viber run      - Run a task locally without connection to command center
 *   viber gateway  - Start the API gateway server (legacy)
 */

import { program } from "commander";
import * as os from "os";
import * as fs from "fs/promises";
import * as path from "path";

const VERSION = "1.0.0";

program
  .name("viber")
  .description("Viber - Multi-agent AI framework")
  .version(VERSION);

// ==================== viber start ====================

program
  .command("start")
  .description("Start the viber daemon and connect to command center")
  .option("-s, --server <url>", "Command center URL", "wss://supen.app/vibers/ws")
  .option("-t, --token <token>", "Authentication token (or set VIBER_TOKEN)")
  .option("-n, --name <name>", "Viber name", `${os.hostname()}-viber`)
  .option("--desktop", "Enable desktop control (UI-TARS)")
  .option("--disable-app <apps...>", "Disable specific apps (comma-separated)")
  .option("--no-apps", "Disable all apps")
  .option("--reconnect-interval <ms>", "Reconnect interval in ms", "5000")
  .option("--heartbeat-interval <ms>", "Heartbeat interval in ms", "30000")
  .action(async (options) => {
    const { ViberController } = await import("../daemon/controller");
    const { loadAllApps, getAvailableApps } = await import("../apps");
    const { EventEmitter } = await import("events");

    // Get or generate viber ID
    const viberId = await getViberId();

    // Token from CLI or env
    const token = options.token || process.env.VIBER_TOKEN;
    if (!token) {
      console.error("Error: Authentication token required.");
      console.error("Use --token <token> or set VIBER_TOKEN environment variable.");
      console.error("\nTo get a token, run: viber login");
      process.exit(1);
    }

    const controller = new ViberController({
      serverUrl: options.server,
      token,
      viberId,
      viberName: options.name,
      enableDesktop: options.desktop,
      reconnectInterval: parseInt(options.reconnectInterval, 10),
      heartbeatInterval: parseInt(options.heartbeatInterval, 10),
    });

    // Load apps (unless --no-apps)
    const appInstances: Map<string, any> = new Map();
    const events = new EventEmitter();

    if (options.apps !== false) {
      const disabledApps = new Set(options.disableApp || []);
      const apps = await loadAllApps();

      for (const [name, app] of apps) {
        if (disabledApps.has(name)) {
          console.log(`[Apps] Skipping disabled app: ${name}`);
          continue;
        }
        try {
          const instance = await app.activate({ events });
          appInstances.set(name, instance);
          console.log(`[Apps] Loaded: ${name}`);
        } catch (error: any) {
          console.warn(`[Apps] Failed to activate '${name}':`, error.message);
        }
      }
    }

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n[Viber] Shutting down...");
      // Stop apps first
      for (const [name, instance] of appInstances) {
        try {
          await instance.stop();
          console.log(`[Apps] Stopped: ${name}`);
        } catch { }
      }
      await controller.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      for (const [, instance] of appInstances) {
        try { await instance.stop(); } catch { }
      }
      await controller.stop();
      process.exit(0);
    });

    // Log connection events
    controller.on("connected", () => {
      const appList = appInstances.size > 0
        ? Array.from(appInstances.keys()).join(", ")
        : "(none)";
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     VIBER RUNNING                          ║
╠═══════════════════════════════════════════════════════════╣
║  Viber ID:     ${viberId.padEnd(40)}║
║  Name:         ${options.name.padEnd(40)}║
║  Server:       ${options.server.slice(0, 40).padEnd(40)}║
║  Desktop:      ${(options.desktop ? "Enabled" : "Disabled").padEnd(40)}║
║  Apps:         ${appList.slice(0, 40).padEnd(40)}║
║  Status:       ● Connected                                ║
╚═══════════════════════════════════════════════════════════╝

Waiting for tasks from command center...
Press Ctrl+C to stop.
      `);
    });

    controller.on("disconnected", () => {
      console.log("[Viber] Connection lost. Reconnecting...");
    });

    controller.on("error", (error) => {
      console.error("[Viber] Error:", error.message);
    });

    // Start apps
    for (const [name, instance] of appInstances) {
      try {
        await instance.start();
        console.log(`[Apps] Started: ${name}`);
      } catch (error: any) {
        console.error(`[Apps] Failed to start '${name}':`, error.message);
      }
    }

    // Start the controller
    await controller.start();
  });

// ==================== viber run ====================

program
  .command("run <goal>")
  .description("Run a task locally without connecting to command center")
  .option("-m, --model <model>", "LLM model to use", "deepseek-chat")
  .option("-a, --agent <agent>", "Single agent to use")
  .option("--desktop", "Enable desktop control")
  .action(async (goal, options) => {
    const { ViberAgent } = await import("../core/viber-agent");

    console.log(`[Viber] Starting local task: ${goal}`);

    try {
      const agent = await ViberAgent.start(goal, {
        model: options.model,
        singleAgentId: options.agent,
      });

      console.log(`[Viber] Space created: ${agent.spaceId}`);

      // Execute task
      const result = await agent.streamText({
        messages: [{ role: "user", content: goal }],
        metadata: {
          mode: "agent",
          requestedAgent: options.agent || "default",
        },
      });

      // Stream output
      for await (const chunk of result.fullStream) {
        if (chunk.type === "text-delta") {
          process.stdout.write(chunk.textDelta);
        }
      }

      console.log("\n\n[Viber] Task completed");
    } catch (error: any) {
      console.error("[Viber] Task failed:", error.message);
      process.exit(1);
    }
  });

// ==================== viber gateway ====================

program
  .command("gateway")
  .description("Start the API gateway server (legacy)")
  .option("-p, --port <port>", "Port to listen on", "3000")
  .action(async (options) => {
    const { startGateway } = await import("../server/gateway");
    const port = parseInt(options.port, 10);
    console.log(`Starting Viber Gateway on port ${port}...`);
    startGateway(port);
  });

// ==================== viber login ====================

program
  .command("login")
  .description("Authenticate with command center and get a token")
  .option("-s, --server <url>", "Command center URL", "http://localhost:3000")
  .action(async (options) => {
    console.log("[Viber] Opening browser for authentication...");
    console.log(`\nVisit: ${options.server}/vibers/register`);
    console.log("\nAfter authentication, you'll receive a token.");
    console.log("Set it as VIBER_TOKEN environment variable or use --token option.\n");

    // Try to open browser
    try {
      const { exec } = await import("child_process");
      const url = `${options.server}/vibers/register`;

      if (process.platform === "darwin") {
        exec(`open "${url}"`);
      } else if (process.platform === "linux") {
        exec(`xdg-open "${url}"`);
      } else if (process.platform === "win32") {
        exec(`start "${url}"`);
      }
    } catch {
      // Ignore - user can manually open URL
    }
  });

// ==================== viber status ====================

// ==================== viber playground ====================

program
  .command("playground")
  .description("Start a playground server (command center for vibers)")
  .option("-p, --port <port>", "Port to listen on", "6007")
  .action(async (options) => {
    const { PlaygroundServer } = await import("../server/playground");
    const port = parseInt(options.port, 10);

    const server = new PlaygroundServer();

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n[Playground] Shutting down...");
      await server.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await server.stop();
      process.exit(0);
    });

    await server.start(port);
  });

// ==================== viber status ====================

program
  .command("status")
  .description("Check viber status and configuration")
  .action(async () => {
    const viberId = await getViberId();
    const hasToken = !!process.env.VIBER_TOKEN;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

    console.log(`
Viber Status
────────────────────────────────────
  Viber ID:      ${viberId}
  Token:         ${hasToken ? "✓ Set (VIBER_TOKEN)" : "✗ Not set"}
  OpenRouter:    ${hasOpenRouter ? "✓ Set (OPENROUTER_API_KEY)" : "✗ Not set"}
  Config Dir:    ${path.join(os.homedir(), ".viber")}
────────────────────────────────────
    `);
  });

// ==================== viber monitor ====================

program
  .command("monitor")
  .description("Start Antigravity monitor (desktop automation)")
  .option("-i, --interval <ms>", "Check interval in milliseconds", "3000")
  .option("--cdp-port <port>", "CDP remote debugging port", "9333")
  .option("--use-vlm", "Use VLM (GPT-4o) instead of CDP for detection")
  .option("-m, --model <model>", "OpenRouter vision model (for VLM mode)", "openai/gpt-4o")
  .option("--max-retries <n>", "Max auto-retries before alerting", "3")
  .action(async (options) => {
    const { AntigravityMonitor } = await import("../apps/antigravity-healing");

    const useVlm = options.useVlm || false;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (useVlm && !apiKey) {
      console.error("Error: VLM mode requires OPENROUTER_API_KEY environment variable.");
      process.exit(1);
    }

    const method = useVlm ? "VLM (Screenshot + GPT-4o)" : "CDP (DOM Query)";
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║              ANTIGRAVITY MONITOR STARTING                  ║
╠═══════════════════════════════════════════════════════════╣
║  Detection:    ${method.padEnd(42)}║
║  Interval:     ${(options.interval + "ms").padEnd(42)}║
║  CDP Port:     ${options.cdpPort.padEnd(42)}║
║  Max Retries:  ${options.maxRetries.padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝

${useVlm ? "" : "⚠️  Tip: Start Antigravity with --remote-debugging-port=9222"}
`);

    const monitor = new AntigravityMonitor({
      interval: parseInt(options.interval, 10),
      cdpPort: parseInt(options.cdpPort, 10),
      useVlm,
      model: options.model,
      maxRetries: parseInt(options.maxRetries, 10),
      apiKey,
      onStatus: (status) => {
        const stateColors: Record<string, string> = {
          idle: "\x1b[90m",        // gray
          monitoring: "\x1b[32m",   // green
          error_detected: "\x1b[31m", // red
          retrying: "\x1b[33m",    // yellow
          waiting_input: "\x1b[36m", // cyan
        };
        const color = stateColors[status.state] || "";
        const reset = "\x1b[0m";
        console.log(`[${new Date().toISOString()}] ${color}${status.state.toUpperCase()}${reset}: ${status.message || ""}`);
      },
    });

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\\n[Monitor] Shutting down...");
      await monitor.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await monitor.stop();
      process.exit(0);
    });

    // Log events
    monitor.on("output", (output: string) => {
      console.log("[Output]", output.slice(0, 200) + (output.length > 200 ? "..." : ""));
    });

    monitor.on("max_retries_reached", () => {
      console.error("\\n⚠️  MAX RETRIES REACHED - Manual intervention needed!");
    });

    // Start monitoring
    await monitor.start();
  });

// ==================== Helpers ====================

async function getViberId(): Promise<string> {
  const configDir = path.join(os.homedir(), ".viber");
  const idFile = path.join(configDir, "viber-id");

  try {
    await fs.mkdir(configDir, { recursive: true });
    const id = await fs.readFile(idFile, "utf8");
    return id.trim();
  } catch {
    // Generate new ID
    const id = `viber-${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36).slice(-6)}`;
    await fs.writeFile(idFile, id);
    return id;
  }
}

// ==================== Main ====================

// Default to monitor command if no args provided
if (process.argv.length === 2) {
  process.argv.push("monitor");
}

program.parse();

