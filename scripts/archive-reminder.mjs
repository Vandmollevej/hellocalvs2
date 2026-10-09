// Claude Code Stop hook: a session that stops with a finished task must end
// with the text "arkiver mig" (AGENTS.md, user rule 2026-10-05). Blocks once
// with a reminder; stays silent while work is in progress (dirty tree,
// unpushed commits) or the session is asking something.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  /* no stdin */
}
if (input.stop_hook_active) process.exit(0);

function lastAssistantText() {
  if (typeof input.last_assistant_message === "string") return input.last_assistant_message;
  if (!input.transcript_path || !existsSync(input.transcript_path)) return "";
  const lines = readFileSync(input.transcript_path, "utf8").split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const e = JSON.parse(lines[i]);
      if (e.type !== "assistant") continue;
      const c = e.message?.content;
      const text = Array.isArray(c) ? c.filter((b) => b.type === "text").map((b) => b.text).join("\n") : String(c ?? "");
      if (text.trim()) return text;
    } catch {
      /* skip bad line */
    }
  }
  return "";
}

const git = (cmd) => execSync(`git ${cmd}`, { cwd: input.cwd || process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

const text = lastAssistantText();
if (/arkiver mig/i.test(text) || text.includes("?")) process.exit(0);
try {
  if (git("status --porcelain")) process.exit(0); // uncommitted work
  if (!git("branch -r --contains HEAD")) process.exit(0); // unpushed commits
} catch {
  process.exit(0); // not a git tree
}
process.stdout.write(
  JSON.stringify({
    decision: "block",
    reason:
      'Opgaven ser færdig ud (rent træ, alt pushet), men sessionen slutter ikke med "arkiver mig". Er opgaven helt færdig og PR\'en flettet, så afslut med præcis teksten "arkiver mig" og ingen anden tekst (AGENTS.md). Er den ikke færdig, så fortsæt med næste skridt.',
  }),
);
