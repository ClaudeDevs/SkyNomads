// Bundles the TypeScript modules into a single build/index.js that Nakama's
// JavaScript runtime (goja) loads. Matches the Heroic Labs template layout.

import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/main.ts",
  output: {
    file: "build/index.js",
    format: "cjs",
  },
  plugins: [resolve(), typescript()],
};
