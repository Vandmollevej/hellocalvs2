import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ---- Designtokens (design.md §13, 2026-10-07) ----
// Al styling går gennem tokens og klasser i src/app/globals.css. Reglerne her
// stopper de tre måder, hardcoding tidligere sneg sig ind på:
//   1. hex-farver i className/style        → brug bg-hf-*/text-hf-*/border-hf-*
//   2. statisk style={{ x: "var(--hf-…)" }} → brug den tilsvarende utility
//   3. text-sm / text-[15px] / font-semibold → brug en .hf-type-*-rolle
// Undtagelser (bevidst, dokumenteret i globals.css-hovedet):
const DESIGN_TOKEN_EXEMPT = [
  "src/app/admin/designmanual/**", // viser farve-/typeværdierne som indhold
  "src/components/admin/PhonePreviewEditor.tsx", // iOS Mail-/låseskærms-mock
  "src/components/hf/HfAccessSheet.tsx", // iOS Sundhedsadgang (systemfarver)
];
// Marketing-sitet bruger Tailwinds typeskala (desktop), men appens farver.
const MARKETING_ZONE = ["src/components/landing/**", "src/app/business/**", "src/app/presse/**", "src/app/om-os/**"];

const HEX = "#[0-9a-fA-F]{3,8}\\b";
const RAW_TYPE =
  "(^|\\s|:)(text-(xs|sm|base|lg|xl|[2-9]xl)|text-\\[\\d+px\\]|font-(thin|light|normal|medium|semibold|bold|extrabold|black))(\\s|$)";

const designTokenRules = [
  {
    name: "design-tokens/colors",
    files: ["src/**/*.tsx"],
    ignores: DESIGN_TOKEN_EXEMPT,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `JSXAttribute[name.name="className"] Literal[value=/${HEX}/]`,
          message: "Hex-farve i className: brug et token (bg-hf-*, text-hf-*, border-hf-*) fra globals.css.",
        },
        {
          selector: `JSXAttribute[name.name="className"] TemplateElement[value.raw=/${HEX}/]`,
          message: "Hex-farve i className: brug et token (bg-hf-*, text-hf-*, border-hf-*) fra globals.css.",
        },
        {
          selector: `JSXAttribute[name.name="style"] Property[key.type="Identifier"] > Literal[value=/${HEX}/]`,
          message: "Hex-farve i style: brug et token (var(--hf-color-*)) eller en utility-klasse.",
        },
        {
          selector: `JSXAttribute[name.name="style"] Property[key.type="Identifier"] > Literal[value=/^var\\(--hf-/]`,
          message: "Statisk style med et token: brug den tilsvarende utility (bg-hf-*, text-hf-*, border-hf-*) i className.",
        },
      ],
    },
  },
  {
    name: "design-tokens/typography",
    files: ["src/**/*.tsx"],
    ignores: [...DESIGN_TOKEN_EXEMPT, ...MARKETING_ZONE],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `JSXAttribute[name.name="className"] Literal[value=/${RAW_TYPE}/]`,
          message: "Rå tekststørrelse/-vægt: brug en .hf-type-*-rolle (+ hf-type-strong) fra globals.css.",
        },
        {
          selector: `JSXAttribute[name.name="className"] TemplateElement[value.raw=/${RAW_TYPE}/]`,
          message: "Rå tekststørrelse/-vægt: brug en .hf-type-*-rolle (+ hf-type-strong) fra globals.css.",
        },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...designTokenRules,
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
