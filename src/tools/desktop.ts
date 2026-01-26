import { z } from "zod";
import { Tool, ToolFunction, ToolMetadata, ToolConfig, ConfigSchema } from "./base";
import { exec } from "child_process";
import { promisify } from "util";

// --- AppleScript Helper ---

const execAsync = promisify(exec);

async function runAppleScript(script: string): Promise<string> {
  const command = `osascript -e '${script}'`;
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`AppleScript failed: ${error.message}`);
  }
}

// --- DesktopTool Wrapper ---

export class DesktopTool extends Tool {
  getMetadata(): ToolMetadata {
    return {
      id: "desktop",
      name: "Desktop Automation",
      description: "Control desktop applications using AppleScript",
      category: "system",
    };
  }

  isAvailable(): boolean {
    return process.platform === "darwin";
  }

  @ToolFunction({
    description: "Open an application by name",
    input: z.object({
      appName: z.string().describe("Name of the application"),
    })
  })
  async open_app(input: { appName: string }) {
    await runAppleScript(`tell application "${input.appName}" to activate`);
    return { success: true, message: `Opened/Activated ${input.appName}` };
  }

  @ToolFunction({
    description: "Bring an application to the front",
    input: z.object({
      appName: z.string().describe("Name of the application"),
    })
  })
  async activate_app(input: { appName: string }) {
    await runAppleScript(`tell application "${input.appName}" to activate`);
    return { success: true, message: `Activated ${input.appName}` };
  }

  @ToolFunction({
    description: "Type text into the currently focused window",
    input: z.object({
      text: z.string().describe("Text to type"),
    })
  })
  async type_text(input: { text: string }) {
    const safeText = input.text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    await runAppleScript(`tell application "System Events" to keystroke "${safeText}"`);
    return { success: true, message: `Typed "${input.text}"` };
  }
}
