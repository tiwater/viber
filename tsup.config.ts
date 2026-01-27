import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "cli/index": "src/cli/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  onSuccess: async () => {
    // Copy defaults folder to dist for runtime access
    const { execSync } = await import("child_process");
    execSync("cp -r src/defaults dist/", { stdio: "inherit" });
    console.log("Copied src/defaults to dist/");
  },
});
