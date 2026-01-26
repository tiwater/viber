import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { skillRegistry } from "./skills";
import { buildToolMap, getAllToolIds, isToolAvailable } from "../tools/index";
import { Skill } from "./skill";

describe("Skill System", () => {
  const testSkill: Skill = {
    name: "test_skill",
    description: "A test skill",
    tools: {
      double: {
        description: "Doubles a number",
        parameters: z.object({ n: z.number() }),
        execute: async ({ n }) => n * 2,
      },
    },
  };

  beforeEach(() => {
    skillRegistry.clear();
    // Re-register default skills because they might be needed, but for this test we focus on testSkill
    // However, buildToolMap calls registerDefaultSkills which registers calculator.
    // So calculator will be present.
    skillRegistry.register(testSkill);
  });

  it("should register and retrieve a skill", () => {
    expect(skillRegistry.has("test_skill")).toBe(true);
    expect(skillRegistry.get("test_skill")).toBe(testSkill);
  });

  it("should make tools available via buildToolMap using skill name", async () => {
    const tools = await buildToolMap(["test_skill"]);
    expect(tools).toHaveProperty("double");
    expect(tools.double.description).toBe("Doubles a number");
    const result = await tools.double.execute({ n: 21 });
    expect(result).toBe(42);
  });

  it("should make tools available via buildToolMap using tool name", async () => {
    const tools = await buildToolMap(["double"]);
    expect(tools).toHaveProperty("double");
    const result = await tools.double.execute({ n: 5 });
    expect(result).toBe(10);
  });

  it("should list tools in getAllToolIds", () => {
    const ids = getAllToolIds();
    expect(ids).toContain("double");
  });

  it("should report availability", () => {
    expect(isToolAvailable("test_skill")).toBe(true);
    expect(isToolAvailable("double")).toBe(true);
    expect(isToolAvailable("non_existent")).toBe(false);
  });

  it("should support calculator skill", async () => {
    // Calculator skill is registered by registerDefaultSkills in real app,
    // but here we cleared registry. Let's register it manually or verify it's there if we import registerDefaultSkills.
    const { calculatorSkill } = await import("../skills/calculator");
    skillRegistry.register(calculatorSkill);

    const tools = await buildToolMap(["calculator"]);
    expect(tools).toHaveProperty("add");
    expect(tools).toHaveProperty("subtract");

    const result = await tools.add.execute({ a: 5, b: 7 });
    expect(result).toBe(12);
  });
});
