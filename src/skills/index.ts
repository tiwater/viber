import { defaultRegistry } from "../core/skills/registry";
import { calculatorSkill } from "./calculator";
import { getTools as getAntigravityTools } from "./antigravity";

// Register default skills and their tools
// This is called during module initialization to pre-register tools
// that would otherwise fail to load at runtime (Node.js can't import .ts files)
export function registerDefaultSkills() {
  // Pre-register antigravity tools so they're available at runtime
  defaultRegistry.preRegisterTools("antigravity", getAntigravityTools());
}

// Export specific skills for manual usage
export { calculatorSkill };

// Auto-register on import
registerDefaultSkills();
