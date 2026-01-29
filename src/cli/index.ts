#!/usr/bin/env node

// Load environment variables from .env file
import "dotenv/config";

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
  .description(
    "Start viber with all apps (local mode, or connect to server with --server)",
  )
  .option("-s, --server <url>", "Command center URL (enables connected mode)")
  .option("-t, --token <token>", "Authentication token (or set VIBER_TOKEN)")
  .option("-n, --name <name>", "Viber name", `${os.hostname()}-viber`)
  .option("--desktop", "Enable desktop control (UI-TARS)")
  .option("--disable-app <apps...>", "Disable specific apps (comma-separated)")
  .option("--no-apps", "Disable all apps")
  .option("--reconnect-interval <ms>", "Reconnect interval in ms", "5000")
  .option("--heartbeat-interval <ms>", "Heartbeat interval in ms", "30000")
  .action(async (options) => {
    const { JobScheduler } = await import("../daemon/scheduler");
    const { ViberController } = await import("../daemon/controller");
    const { EventEmitter } = await import("events");

    // Import skills module to trigger pre-registration of skill tools
    await import("../skills");

    // Get or generate viber ID
    const viberId = await getViberId();

    // Token from CLI or env (only required if connecting to server)
    const token = options.token || process.env.VIBER_TOKEN;
    const connectToServer = options.server && token;

    if (options.server && !token) {
      console.error(
        "Error: Authentication token required when using --server.",
      );
      console.error(
        "Use --token <token> or set VIBER_TOKEN environment variable.",
      );
      console.error("\nTo get a token, run: viber login");
      process.exit(1);
    }

    // Initialize Scheduler
    // For demo purposes, we load from "examples/jobs". In production, this would be ~/.viber/jobs
    const jobsDir = path.resolve(process.cwd(), "examples/jobs");
    const scheduler = new JobScheduler(jobsDir);

    console.log(`[Viber] Initializing Cron Scheduler (jobs: ${jobsDir})...`);
    await scheduler.start();

    // Handle graceful shutdown
    const cleanup = async () => {
      console.log("\n[Viber] Shutting down...");
      await scheduler.stop();
    };

    process.on("SIGINT", async () => {
      await cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await cleanup();
      process.exit(0);
    });

    if (connectToServer) {
      // Connected mode - connect to command center
      const controller = new ViberController({
        serverUrl: options.server,
        token,
        viberId,
        viberName: options.name,
        enableDesktop: options.desktop,
        reconnectInterval: parseInt(options.reconnectInterval, 10),
        heartbeatInterval: parseInt(options.heartbeatInterval, 10),
      });

      controller.on("connected", () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     VIBER RUNNING                          ║
╠═══════════════════════════════════════════════════════════╣
║  Mode:         Connected                                  ║
║  Viber ID:     ${viberId.padEnd(40)}║
║  Server:       ${options.server.slice(0, 40).padEnd(40)}║
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

      await controller.start();
    } else {
      // Local mode - just run scheduler
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     VIBER RUNNING                          ║
╠═══════════════════════════════════════════════════════════╣
║  Mode:         Local (Cron Only)                          ║
║  Status:       ● Running                                  ║
╚═══════════════════════════════════════════════════════════╝

Running locally. Press Ctrl+C to stop.
      `);

      // Keep process alive
      await new Promise(() => {});
    }
  });

// ==================== viber run ====================

program
  .command("run <goal>")
  .description("Run a task locally without connecting to command center")
  .option("-m, --model <model>", "LLM model to use", "deepseek/deepseek-chat")
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
    console.log(
      "Set it as VIBER_TOKEN environment variable or use --token option.\n",
    );

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

// Monitor command removed - functionality moved to 'antigravity-healing' app
// Use `viber start` to run background apps.

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
    const id = `viber-${os
      .hostname()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36).slice(-6)}`;
    await fs.writeFile(idFile, id);
    return id;
  }
}

// ==================== Main ====================

program.parse();
