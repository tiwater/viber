import { Cron } from "croner";
import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "yaml";


export interface CronJobConfig {
  name: string;
  description?: string;
  schedule: string; // Cron expression or "interval: 3s" (parsed manually if needed, or croner handles ISO/Intervals?)
  // Croner handles ISO 8601, but "*/3 * * * * *" is standard cron.
  agent?: string;
  model?: string;
  skills?: string[];
  tools?: string[];
  prompt: string;
}

export class JobScheduler {
  private jobs: Map<string, Cron> = new Map();
  private active: boolean = false;

  constructor(private jobsDir: string) { }

  async start() {
    this.active = true;
    await this.loadJobs();
  }

  async stop() {
    this.active = false;
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }

  private async loadJobs() {
    try {
      // Check if directory exists
      try {
        await fs.access(this.jobsDir);
      } catch {
        console.warn(`[Scheduler] Jobs directory not found: ${this.jobsDir}`);
        return;
      }

      const files = await fs.readdir(this.jobsDir);
      for (const file of files) {
        if (file.endsWith(".yaml") || file.endsWith(".yml")) {
          const content = await fs.readFile(path.join(this.jobsDir, file), "utf8");
          try {
            const config = yaml.parse(content) as CronJobConfig;
            this.scheduleJob(config);
          } catch (err) {
            console.error(`[Scheduler] Failed to parse job ${file}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[Scheduler] Error loading jobs:", err);
    }
  }

  private scheduleJob(config: CronJobConfig) {
    console.log(`[Scheduler] Scheduling job: ${config.name} (${config.schedule})`);

    // Handle "interval: 3s" style if user uses it, though we recommend standard Cron
    // Croner supports "ISO 8601 duration" or pattern.
    // If config.schedule starts with "*", assume cron.
    // If it is a number, assume ms?

    // For specific antigravity case: "*/3 * * * * *" is every 3 seconds.

    try {
      const job = new Cron(config.schedule, async () => {
        if (!this.active) return;
        await this.executeJob(config);
      });

      this.jobs.set(config.name, job);
    } catch (err) {
      console.error(`[Scheduler] Invalid schedule for ${config.name}:`, err);
    }
  }

  private async executeJob(config: CronJobConfig) {
    // console.log(`[Scheduler] Running job: ${config.name}`);

    // If model is specified, use full Agent
    if (config.model) {
      try {
        const { parseModelString } = await import("../provider");
        const { Agent } = await import("../agent");

        const { provider, modelName } = parseModelString(config.model);

        const agent = new Agent({
          name: config.name,
          description: config.description || "Cron Job Agent",
          skills: config.skills,
          tools: config.tools,
          llm: {
            provider,
            model: modelName
          },
        });

        // Execute prompt
        // We use generateText for single-turn execution
        const result = await agent.generateText({
          messages: [{ role: "user", content: config.prompt }]
        });

        console.log(`[${config.name}] Result:`, result.text);

      } catch (err) {
        console.error(`[${config.name}] Agent execution failed:`, err);
      }
      return;
    }

    // Fallback: Hardcoded optimization for BrowserCDP if no model specified (Legacy/Fast Path)
    // This allows "script-like" execution without LLM inference cost if the prompt matches known patterns
    // (For now, we keep the Healer optimization as a fallback or if user omits model)
    // Fallback or legacy logic removed for cleaner architecture.
    if (!config.model) {
      console.warn(`[${config.name}] No model specified, skipping execution.`);
    }
  }
}
