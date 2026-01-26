import { z } from "zod";
import WebSocket from "ws";
import { Tool, ToolFunction, ToolMetadata, ToolConfig, ConfigSchema } from "./base";

// --- BrowserCDP Implementation ---

export interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export interface BrowserCDPConfig {
  host?: string;
  port?: number;
}

export class BrowserCDP {
  private host: string;
  private port: number;
  private messageId = 0;

  constructor(config: BrowserCDPConfig = {}) {
    this.host = config.host || "localhost";
    this.port = config.port || 9222;
  }

  /**
   * List all available targets (pages, iframes, etc.)
   */
  async listTargets(): Promise<CDPTarget[]> {
    const res = await fetch(`http://${this.host}:${this.port}/json`);
    if (!res.ok) {
      throw new Error(`CDP not available at ${this.host}:${this.port}`);
    }
    return await res.json();
  }

  /**
   * Find a target by predicate
   */
  async findTarget(predicate: (t: CDPTarget) => boolean): Promise<CDPTarget | undefined> {
    const targets = await this.listTargets();
    return targets.find(predicate);
  }

  /**
   * Execute (evaluate) JavaScript in a specific target
   */
  async evaluate<T = any>(
    target: CDPTarget | string,
    expression: string,
    awaitPromise = false
  ): Promise<T> {
    const wsUrl = typeof target === "string" ? target : target.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error("Target has no WebSocket URL");

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const id = ++this.messageId;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("CDP evaluation timeout"));
      }, 10000);

      ws.on("open", () => {
        ws.send(JSON.stringify({
          id,
          method: "Runtime.evaluate",
          params: {
            expression,
            returnByValue: true,
            awaitPromise
          }
        }));
      });

      ws.on("message", (data: string) => {
        try {
          const msg = JSON.parse(data);
          if (msg.id === id) {
            clearTimeout(timeout);
            ws.close();

            if (msg.error) {
              reject(new Error(msg.error.message));
            } else if (msg.result?.exceptionDetails) {
              reject(new Error(`Runtime exception: ${msg.result.exceptionDetails.text}`));
            } else {
              resolve(msg.result?.result?.value);
            }
          }
        } catch (err) {
          clearTimeout(timeout);
          ws.close();
          reject(err);
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
  /**
   * Check if text exists in the page body
   */
  async hasText(target: CDPTarget | string, text: string): Promise<boolean> {
    return this.evaluate<boolean>(target, `document.body.innerText.includes("${text}")`);
  }

  /**
   * Click an element containing specific text
   */
  async clickOnText(target: CDPTarget | string, text: string, tag: string = "button"): Promise<boolean> {
    return this.evaluate<boolean>(target, `
      (function() {
        // Helper to find element by text
        const elements = Array.from(document.querySelectorAll("${tag}"));
        const el = elements.find(e => e.textContent.includes("${text}"));
        if (el) {
          el.click();
          return true;
        }
        return false;
      })()
    `);
  }

  /**
   * Get a simplified DOM snapshot (useful for LLM context)
   */
  async getDomSnapshot(target: CDPTarget | string): Promise<string> {
    return this.evaluate<string>(target, `
      (function() {
        // Simple DOM serializer to text
        return document.body.innerText;
      })()
    `);
  }
}

// --- BrowserTool Wrapper ---

export class BrowserTool extends Tool {
  private cdp: BrowserCDP | null = null;

  getMetadata(): ToolMetadata {
    return {
      id: "browser",
      name: "Browser Automation",
      description: "Control a web browser using Chrome DevTools Protocol (CDP)",
      category: "browser",
    };
  }

  isAvailable(): boolean {
    return true; // Or check if Chrome is running?
  }

  private async getCdp(): Promise<BrowserCDP> {
    if (!this.cdp) {
      this.cdp = new BrowserCDP();
    }
    return this.cdp;
  }

  @ToolFunction({
    description: "Launch or connect to a browser instance",
    input: z.object({
      headless: z.boolean().optional().default(false),
    })
  })
  async launch_browser(input: { headless?: boolean }) {
    // This might be a no-op if we assume connecting to existing
    return { success: true, message: "Browser connection managed by CDP" };
  }

  @ToolFunction({
    description: "List all open browser pages/targets",
    input: z.object({})
  })
  async list_targets() {
    const cdp = await this.getCdp();
    return await cdp.listTargets();
  }

  @ToolFunction({
    description: "Find a browser page that contains specific text",
    input: z.object({
      text: z.string().describe("Text to search for"),
    })
  })
  async find_page_with_text(input: { text: string }) {
    const cdp = await this.getCdp();
    const targets = await cdp.listTargets();
    const pages = targets.filter((t: CDPTarget) => t.type === 'page');

    for (const page of pages) {
      const hasIt = await cdp.hasText(page, input.text);
      if (hasIt) return { found: true, targetId: page.id, title: page.title, url: page.url };
    }
    return { found: false };
  }

  @ToolFunction({
    description: "Click on an element containing specific text",
    input: z.object({
      text: z.string().describe("Text of the element to click"),
      targetId: z.string().optional().describe("Specific page ID to target (optional)"),
    })
  })
  async click_element(input: { text: string, targetId?: string }) {
    const cdp = await this.getCdp();
    let page: CDPTarget | undefined; // Initialize page as CDPTarget or undefined

    if (input.targetId) {
      // If targetId is provided, we need to find the full CDPTarget object
      // as the evaluate method requires webSocketDebuggerUrl
      const targets = await cdp.listTargets();
      page = targets.find((t: CDPTarget) => t.id === input.targetId);
    } else {
      const targets = await cdp.listTargets();
      page = targets.find((t: CDPTarget) => t.type === 'page' && !t.url.startsWith('chrome'));
    }

    if (!page) throw new Error("No active page found or targetId not found");

    await cdp.clickOnText(page, input.text);
    return { success: true, message: `Clicked element with text "${input.text}"` };
  }
}
