import { skillRegistry } from "../core/skills";
import { calculatorSkill } from "./calculator";

// Register default skills
export function registerDefaultSkills() {
  skillRegistry.register(calculatorSkill);
}

// Export specific skills for manual usage
export { calculatorSkill };
