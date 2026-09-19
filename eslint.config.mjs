import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code agent worktrees/scratch state — never app source, and each
    // worktree has its own .next build output that isn't excluded by the
    // plain ".next/**" pattern once nested this deep.
    ".claude/**",
    // Reference-only ChatGPT handoff package (docs/DECISIONS.md, 2026-09-17)
    // — its code/ subtree was the integration source, not app source; the
    // actual app copies live under src/.
    "HelloCal_OpenAI_ProductRecognition_Handoff_2026-09-16/**",
  ]),
]);

export default eslintConfig;
