"""Faktatjek af en E-nummer-chunk lokalt via Claude API med websøgning.

Følger scripts/e-numre/data/round3-todo/INSTRUCTIONS.md: hver post sendes til
Claude med web_search/web_fetch, og resultatet (inkl. verification og claims)
skrives til scripts/e-numre/data/verified/r3_chunkNN.json.

Installation (uden admin-rettigheder):
    py -m pip install --user anthropic

API-nøgle (PowerShell, kun for den aktuelle terminal):
    $env:ANTHROPIC_API_KEY = "sk-ant-..."

Kørsel fra repo-roden:
    py scripts/e-numre/verify_local.py 11
    py scripts/e-numre/verify_local.py 11 --only E961 E962   # kun udvalgte poster
    py scripts/e-numre/verify_local.py 11 --dry-run           # vis prompt, kald ikke API

Scriptet gemmer efter hver post og springer poster over, der allerede er i
outputfilen, så en afbrudt kørsel kan genoptages. Brug --force for at køre alt igen.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import anthropic

MODEL = "claude-opus-5-5"
EFFORT = "high"
MAX_TOKENS = 64000
MAX_SEARCHES_PER_ENTRY = 40
MAX_PAUSE_CONTINUATIONS = 8
MAX_ATTEMPTS = 2

# Britiske kilder må aldrig bruges som belæg for EU-forhold (INSTRUCTIONS.md punkt 4).
BLOCKED_DOMAINS = ["food.gov.uk", "legislation.gov.uk", "data.food.gov.uk"]

ROOT = Path(__file__).resolve().parent / "data"
TODO_DIR = ROOT / "round3-todo"
OUT_DIR = ROOT / "verified"

SYSTEM_PROMPT = """Du faktatjekker én post i et katalog over E-numre (EU-fødevaretilsætningsstoffer).
Følg instruktionerne nedenfor nøje. Brug web_search og web_fetch til at finde belæg for hvert udsagn;
brug ikke egen viden som belæg. Skriv al tekst på korrekt, detaljeret dansk med æøå.

Når du er færdig, skal dit sidste svar KUN indeholde den opdaterede post som ét JSON-objekt i en
```json-kodeblok. Behold alle felter fra inputposten (også dem du ikke ændrer), ret kun indhold,
og tilføj/erstat felterne "verification" og "claims" som beskrevet.

=== INSTRUCTIONS.md ===
{instructions}
"""


def build_tools() -> list[dict]:
    return [
        {
            "type": "web_search_20260209",
            "name": "web_search",
            "max_uses": MAX_SEARCHES_PER_ENTRY,
            "blocked_domains": BLOCKED_DOMAINS,
        },
        {
            "type": "web_fetch_20260209",
            "name": "web_fetch",
            "max_uses": MAX_SEARCHES_PER_ENTRY,
            "blocked_domains": BLOCKED_DOMAINS,
        },
    ]


def extract_json(text: str) -> dict:
    blocks = re.findall(r"```json\s*(.*?)```", text, flags=re.DOTALL)
    candidate = blocks[-1] if blocks else text[text.find("{") : text.rfind("}") + 1]
    return json.loads(candidate)


def validate(original: dict, result: dict) -> list[str]:
    errors = []
    if result.get("code") != original["code"]:
        errors.append(f"code ændret: {result.get('code')!r} != {original['code']!r}")
    missing = set(original) - set(result)
    if missing:
        errors.append(f"felter mangler: {sorted(missing)}")
    ver = result.get("verification")
    if not isinstance(ver, dict) or ver.get("status") not in {"verified", "corrected", "uncertain"}:
        errors.append("verification.status mangler eller er ugyldig")
    else:
        uk = [s for s in ver.get("sources", []) if any(d in s for d in BLOCKED_DOMAINS)]
        if uk:
            errors.append(f"britiske kilder i verification.sources: {uk}")
    claims = result.get("claims")
    if not isinstance(claims, list) or not claims:
        errors.append("claims mangler eller er tom")
    elif any(c.get("result") not in {"bekræftet", "rettet", "fjernet"} for c in claims):
        errors.append("claims.result skal være bekræftet/rettet/fjernet")
    return errors


def run_entry(client: anthropic.Anthropic, system: str, entry: dict, feedback: str | None) -> tuple[dict, dict]:
    user_text = "Faktatjek denne post:\n\n```json\n" + json.dumps(entry, ensure_ascii=False, indent=2) + "\n```"
    if feedback:
        user_text += f"\n\nEt tidligere forsøg blev afvist af valideringen: {feedback}. Ret det."
    messages: list[dict] = [{"role": "user", "content": user_text}]
    usage = {"input": 0, "output": 0}

    for _ in range(MAX_PAUSE_CONTINUATIONS + 1):
        with client.beta.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            tools=build_tools(),
            output_config={"effort": EFFORT},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=messages,
        ) as stream:
            response = stream.get_final_message()

        usage["input"] += response.usage.input_tokens
        usage["output"] += response.usage.output_tokens

        if response.stop_reason == "pause_turn":
            # Serveren genoptager selv, når den afbrudte tur sendes tilbage uændret.
            messages.append({"role": "assistant", "content": response.content})
            continue
        if response.stop_reason == "refusal":
            raise RuntimeError(f"Afvist af modellen: {response.stop_details}")
        if response.stop_reason == "max_tokens":
            raise RuntimeError("Svaret blev afkortet (max_tokens)")

        text = "".join(b.text for b in response.content if b.type == "text")
        return extract_json(text), usage

    raise RuntimeError("For mange pause_turn-fortsættelser")


def main() -> int:
    # Windows-terminaler bruger ellers ofte cp1252 og kan fejle på tegn i output.
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("chunk", help="chunk-nummer, fx 11")
    parser.add_argument("--only", nargs="*", help="kun disse E-numre")
    parser.add_argument("--force", action="store_true", help="kør også poster, der allerede er færdige")
    parser.add_argument("--dry-run", action="store_true", help="vis prompt for første post uden API-kald")
    args = parser.parse_args()

    chunk = args.chunk.zfill(2)
    src = TODO_DIR / f"chunk{chunk}.json"
    out = OUT_DIR / f"r3_chunk{chunk}.json"
    entries = json.loads(src.read_text(encoding="utf-8"))
    system = SYSTEM_PROMPT.format(instructions=(TODO_DIR / "INSTRUCTIONS.md").read_text(encoding="utf-8"))

    existing: dict[str, dict] = {}
    if out.exists():
        existing = {e["code"]: e for e in json.loads(out.read_text(encoding="utf-8")) if e.get("claims")}
    done: dict[str, dict] = {} if args.force else dict(existing)

    todo = [e for e in entries if (not args.only or e["code"] in args.only) and e["code"] not in done]
    print(f"{src.name}: {len(entries)} poster, {len(done)} allerede færdige, {len(todo)} køres nu")

    if args.dry_run:
        print(system[:1500], "...\n")
        print(json.dumps(todo[0] if todo else {}, ensure_ascii=False, indent=2))
        return 0

    client = anthropic.Anthropic()
    total = {"input": 0, "output": 0}
    failed = []

    for i, entry in enumerate(todo, 1):
        code = entry["code"]
        print(f"[{i}/{len(todo)}] {code} ...", flush=True)
        feedback = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                result, usage = run_entry(client, system, entry, feedback)
            except (json.JSONDecodeError, RuntimeError) as e:
                feedback = str(e)
                print(f"    forsøg {attempt} fejlede: {feedback}")
                continue
            except anthropic.APIStatusError as e:
                print(f"    API-fejl {e.status_code}: {e.message}")
                feedback = None
                break
            total["input"] += usage["input"]
            total["output"] += usage["output"]
            errors = validate(entry, result)
            if errors:
                feedback = "; ".join(errors)
                print(f"    forsøg {attempt} ugyldigt: {feedback}")
                continue
            # Bevar felter modellen evt. har udeladt, og hold rækkefølgen fra inputposten.
            done[code] = {**entry, **result}
            counts = {r: sum(c["result"] == r for c in result["claims"]) for r in ("bekræftet", "rettet", "fjernet")}
            print(f"    {result['verification']['status']} {counts}")
            break

        if code not in done:
            failed.append(code)

        # Gem efter hver post i samme rækkefølge som inputfilen.
        # Ved --force beholdes tidligere resultater, indtil en post er kørt igen.
        ordered = [done.get(e["code"]) or existing.get(e["code"]) or e for e in entries]
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    cost = total["input"] / 1e6 * 4 + total["output"] / 1e6 * 20
    print(f"\nTokens: {total['input']:,} ind / {total['output']:,} ud (ca. ${cost:.2f} ekskl. søgegebyrer)")
    print(f"Skrevet til {out}")
    if failed:
        print(f"Ikke færdige: {', '.join(failed)} — kør scriptet igen for at prøve dem på ny.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
