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
// Marketing keeps its own desktop scale through .mk-type-* in globals.css.

const HEX = "#[0-9a-fA-F]{3,8}\\b";
const RAW_TYPE =
  "(^|\\s|:)(text-(xs|sm|base|lg|xl|[2-9]xl)|text-\\[\\d+px\\]|font-(thin|light|normal|medium|semibold|bold|extrabold|black))(\\s|$)";

const COLOR_SELECTORS = [
  {
    selector: 'JSXAttribute[name.name=/^(fill|stroke)$/] > Literal[value=/^var\\(--hf-/]',
    message: "Fast SVG-tokenfarve: brug den tilsvarende fill-hf-* eller stroke-hf-* klasse. Dynamiske paints og original ikonkunst bevares.",
  },
  {
    selector: 'JSXAttribute[name.name="style"] Property[key.type="Identifier"][key.name=/^(fontFamily|fontWeight|fontSize|borderRadius|boxShadow)$/] > Literal',
    message: "Fast font, radius eller skygge i inline-style: flyt egenskaben til en fælles klasse i globals.css. Dynamiske data og platformvarianter bevares særskilt.",
  },
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
];

const TYPE_SELECTORS = [
  {
    selector: 'JSXAttribute[name.name=/^(fontSize|fontWeight)$/] > Literal, JSXAttribute[name.name=/^(fontSize|fontWeight)$/] > JSXExpressionContainer > Literal',
    message: "Fast SVG-typografi: brug en fælles hf-chart-axis- eller hf-type-klasse. Dynamisk geometri kan stadig parameteriseres.",
  },
  {
    selector: `JSXAttribute[name.name="className"] Literal[value=/${RAW_TYPE}/]`,
    message: "Rå tekststørrelse/-vægt: brug .hf-type-* til app/admin eller .mk-type-* til marketing fra globals.css.",
  },
  {
    selector: `JSXAttribute[name.name="className"] TemplateElement[value.raw=/${RAW_TYPE}/]`,
    message: "Rå tekststørrelse/-vægt: brug .hf-type-* til app/admin eller .mk-type-* til marketing fra globals.css.",
  },
];

// Admin (bruger 2026-10-11): knapper og felter bruger KUN de fælles klasser
// (.hf-btn-*, .hf-choice, .hf-input) — ingen side må selv sætte kant, baggrund,
// radius, skrift eller indre luft på <button>/<input>/<select>/<textarea>.
const CONTROL_STYLE =
  "(^|\\s|:)(rounded(-[a-z0-9]+)?|border(-[a-z0-9-]+)?|bg-(hf|page|surface)[a-z0-9-]*|p[xy]-[0-9.]+|hf-type-[a-z-]+)(\\s|$)";
const CONTROL_MESSAGE =
  "Hjemmelavet knap-/feltstil i admin: brug .hf-btn-primary/-brand/-secondary/-danger/-text/-icon, .hf-choice eller .hf-input (+ .hf-btn--compact/.hf-btn--inline/.hf-input--compact) fra globals.css.";
const ADMIN_CONTROL_SELECTORS = [
  {
    selector: `JSXOpeningElement[name.name=/^(button|input|select|textarea)$/] > JSXAttribute[name.name="className"] Literal[value=/${CONTROL_STYLE}/]`,
    message: CONTROL_MESSAGE,
  },
  {
    selector: `JSXOpeningElement[name.name=/^(button|input|select|textarea)$/] > JSXAttribute[name.name="className"] TemplateElement[value.raw=/${CONTROL_STYLE}/]`,
    message: CONTROL_MESSAGE,
  },
];

const designTokenRules = [
  {
    name: "design-tokens/colors",
    files: ["src/**/*.tsx"],
    ignores: DESIGN_TOKEN_EXEMPT,
    rules: { "no-restricted-syntax": ["error", ...COLOR_SELECTORS] },
  },
  {
    name: "design-tokens/typography",
    files: ["src/**/*.tsx"],
    ignores: DESIGN_TOKEN_EXEMPT,
    rules: { "no-restricted-syntax": ["error", ...COLOR_SELECTORS, ...TYPE_SELECTORS] },
  },
  {
    // Et senere config-objekt erstatter no-restricted-syntax for filerne, så
    // farve- og typografi-reglerne gentages her.
    name: "design-tokens/admin-controls",
    files: ["src/app/admin/**/*.tsx", "src/components/admin/**/*.tsx"],
    ignores: [...DESIGN_TOKEN_EXEMPT, "src/components/admin/AdminShell.tsx"],
    rules: { "no-restricted-syntax": ["error", ...COLOR_SELECTORS, ...TYPE_SELECTORS, ...ADMIN_CONTROL_SELECTORS] },
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
