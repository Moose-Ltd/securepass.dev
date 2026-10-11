import { defineConfig } from "vitest/config";
import { wordlistPlugin } from "./build/wordlist-plugin.ts";

export default defineConfig({
  // Tests import the wordlist through the same transform the build ships.
  plugins: [wordlistPlugin()],
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
});
