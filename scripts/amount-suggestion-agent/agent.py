"""
HELLO CAL mængde-robot (docs/DECISIONS.md 2026-09-25 "Mængde-robot").

Finder den mest sandsynlige mængde pr. vare, så mængde-slideren på
/add/[id] starter dér i stedet for på 100 g. To kontekster regnes hver for
sig: EATEN (registreringer, fx "agurk spist rå") og RECIPE (ingredienser lagt
i en ret/opskrift).

Ikke et råt gennemsnit (én tastefejl på 5000 g ødelægger det, og ingen
vælger "137 g"):
  1. Tidsvægt: nyere valg vejer mest (halveringstid), så skiftende vaner slår
     igennem.
  2. Loft pr. bruger: én storbruger tæller højst som `perUserCap` valg.
  3. Yderpunkter trimmes i begge ender (vægtede kvantiler).
  4. Typetallet (mode) findes med en vægtet kernel density estimate på
     log-skala — mængder er multiplikative, og folk vælger klumper af "runde"
     tal (en hel agurk, 100 g, en pakke). Kandidaterne er de faktisk valgte
     mængder, så forslaget altid er et tal nogen rent faktisk har valgt.
  5. Få data: forslaget trækkes mod kategoriens typiske mængde (bayesiansk
     shrinkage med `priorStrength`), og confidence følger det effektive antal
     valg og hvor samlet de ligger.
  6. Anonymitet: en vare får kun et fælles forslag, når mindst `minUsers`
     forskellige brugere har valgt en mængde. Kun aggregater gemmes.

Brugerens egen vane blandes først på i app'en (src/lib/amount-suggestion.ts).

Konfiguration og status ligger i robot_configs (key="amount-suggestion") og
redigeres i /admin/robots. Robotten tjekker hvert minut, om den skal køre
(interval udløbet eller "Kør nu" trykket), og skriver heartbeat + resultat
tilbage. Ren Python/SQL — ingen AI og ingen netværk ud af huset.
"""

import json
import logging
import math
import os
import secrets
import time
from collections import defaultdict
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("amount-suggestion-agent")

# Prisma's DATABASE_URL carries a `?schema=public` query param that
# psycopg2/libpq doesn't recognize; Postgres already defaults to "public".
DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
TICK_SECONDS = int(os.environ.get("TICK_SECONDS", "60"))
ROBOT_KEY = "amount-suggestion"

# Samme standarder og grænser som src/lib/amount-suggestion-config.ts.
DEFAULT_SETTINGS = {
    "useInApp": True,
    "intervalMinutes": 360,
    "lookbackDays": 365,
    "halfLifeDays": 90,
    "minUsers": 3,
    "minSamples": 3,
    "perUserCap": 5,
    "trimPercent": 5,
    "priorStrength": 4,
    "personalWeight": 1.5,
    "personalHistory": 10,
}
LIMITS = {
    "intervalMinutes": (15, 10080),
    "lookbackDays": (7, 1825),
    "halfLifeDays": (1, 1825),
    "minUsers": (2, 100),
    "minSamples": (1, 100),
    "perUserCap": (1, 100),
    "trimPercent": (0, 25),
    "priorStrength": (0, 50),
    "personalWeight": (0.1, 20),
    "personalHistory": (1, 50),
}

# Alt over 5 kg for én vare på én gang er tastefejl, ikke en mængde.
MAX_GRAMS = 5000


def sanitize(raw):
    settings = dict(DEFAULT_SETTINGS)
    if isinstance(raw, dict):
        if isinstance(raw.get("useInApp"), bool):
            settings["useInApp"] = raw["useInApp"]
        for key, (low, high) in LIMITS.items():
            try:
                value = float(raw.get(key))
            except (TypeError, ValueError):
                continue
            if math.isfinite(value):
                settings[key] = min(high, max(low, value))
    return settings


# --- statistik -------------------------------------------------------------


def weighted_quantile(points, q):
    """points: sorteret liste af (værdi, vægt)."""
    total = sum(w for _, w in points)
    target = q * total
    cumulative = 0.0
    for value, weight in points:
        cumulative += weight
        if cumulative >= target:
            return value
    return points[-1][0]


def effective_n(weights):
    total = sum(weights)
    squares = sum(w * w for w in weights)
    return (total * total / squares) if squares > 0 else 0.0


def weighted_mode(points):
    """
    Typetallet af en vægtet fordeling på log-skala via Gaussisk KDE.
    points: sorteret liste af (gram, vægt). Returnerer (gram, båndbredde).
    """
    logs = [(math.log(g), w) for g, w in points]
    total = sum(w for _, w in logs)
    mean = sum(x * w for x, w in logs) / total
    sd = math.sqrt(sum(w * (x - mean) ** 2 for x, w in logs) / total)
    iqr = weighted_quantile(logs, 0.75) - weighted_quantile(logs, 0.25)
    spread = min(sd, iqr / 1.34) if iqr > 0 else sd
    n_eff = effective_n([w for _, w in logs])
    # Silvermans tommelfingerregel, klemt så én klump ikke smelter sammen
    # med naboen (min ~5 %) og få data ikke giver en nål (max ~50 %).
    bandwidth = min(0.5, max(0.05, 0.9 * spread * n_eff ** (-0.2))) if spread > 0 else 0.05

    # Densiteten evalueres i hver unik valgt mængde; gram der ligger tæt
    # (fx 100 og 100) lægges sammen først.
    candidates = sorted({round(g, 1) for g, _ in points})
    best = None
    for candidate in candidates:
        x0 = math.log(candidate)
        density = sum(w * math.exp(-0.5 * ((x - x0) / bandwidth) ** 2) for x, w in logs)
        if best is None or density > best[1] + 1e-12:
            best = (candidate, density)
    return best[0], bandwidth


def summarize(samples, settings, now):
    """
    samples: liste af (userId, gram, tidspunkt). Returnerer dict med mode,
    kvantiler, n_eff, brugerantal og samlethed — eller None uden data.
    """
    half_life = settings["halfLifeDays"]
    cap = settings["perUserCap"]
    per_user = defaultdict(list)
    for user_id, grams, created_at in samples:
        if not grams or grams <= 0 or grams > MAX_GRAMS:
            continue
        age_days = max(0.0, (now - created_at).total_seconds() / 86400)
        per_user[user_id].append((float(grams), 0.5 ** (age_days / half_life)))
    if not per_user:
        return None

    points = []
    for entries in per_user.values():
        user_total = sum(w for _, w in entries)
        scale = min(1.0, cap / user_total) if user_total > 0 else 0.0
        points.extend((g, w * scale) for g, w in entries)
    points.sort()

    trim = settings["trimPercent"] / 100
    if trim > 0 and len(points) >= 10:
        low = weighted_quantile(points, trim)
        high = weighted_quantile(points, 1 - trim)
        points = [(g, w) for g, w in points if low <= g <= high] or points

    mode, bandwidth = weighted_mode(points)
    total = sum(w for _, w in points)
    # Samlethed: andel af vægten inden for ±25 % af typetallet. 1 = alle
    # vælger ca. det samme; lav = mængden er meget individuel.
    near = sum(w for g, w in points if abs(math.log(g / mode)) <= math.log(1.25))
    return {
        "mode": mode,
        "p25": weighted_quantile(points, 0.25),
        "median": weighted_quantile(points, 0.5),
        "p75": weighted_quantile(points, 0.75),
        "n_eff": effective_n([w for _, w in points]),
        "samples": len(points),
        "users": len(per_user),
        "concentration": near / total if total > 0 else 0.0,
        "bandwidth": bandwidth,
    }


def geometric_blend(value, weight, prior, prior_weight):
    if prior is None or prior_weight <= 0:
        return value
    return math.exp((weight * math.log(value) + prior_weight * math.log(prior)) / (weight + prior_weight))


def confidence(n_eff, concentration, prior_strength):
    base = n_eff / (n_eff + max(prior_strength, 1.0))
    return round(max(0.0, min(1.0, base * (0.5 + 0.5 * concentration))), 3)


# --- data ------------------------------------------------------------------


def fetch_samples(conn, lookback_days):
    """
    Returnerer {(context, itemType, itemId): [(userId, gram, tidspunkt)]} og
    en kategori-opslagstabel {(itemType, itemId): (kategoriType, kategori)}.
    Private ingredienser (privateOwnerId) er kun én brugers og holdes ude.
    """
    samples = defaultdict(list)
    categories = {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT r."userId", r."amountGrams", r."createdAt",
                   r."productId", p."productCategory"::text,
                   r."genericIngredientId", gi.category::text
            FROM registrations r
            LEFT JOIN products p ON p.id = r."productId"
            LEFT JOIN generic_ingredients gi ON gi.id = r."genericIngredientId"
            WHERE r."createdAt" >= now() - make_interval(days => %s)
              AND r."dishId" IS NULL
              AND (r."productId" IS NOT NULL OR r."genericIngredientId" IS NOT NULL)
              AND p."privateOwnerId" IS NULL
            """,
            (int(lookback_days),),
        )
        for user_id, grams, created_at, product_id, product_cat, generic_id, generic_cat in cur:
            if product_id:
                key = ("PRODUCT", product_id)
                categories[key] = ("PRODUCT_CATEGORY", product_cat) if product_cat else None
            else:
                key = ("GENERIC_INGREDIENT", generic_id)
                categories[key] = ("GENERIC_CATEGORY", generic_cat)
            samples[("EATEN",) + key].append((user_id, grams, created_at))

        cur.execute(
            """
            SELECT d."ownerId", di.grams, d."createdAt", di."productId", p."productCategory"::text
            FROM dish_ingredients di
            JOIN dishes d ON d.id = di."dishId"
            JOIN products p ON p.id = di."productId"
            WHERE d."createdAt" >= now() - make_interval(days => %s)
              AND p."privateOwnerId" IS NULL
            """,
            (int(lookback_days),),
        )
        for user_id, grams, created_at, product_id, product_cat in cur:
            key = ("PRODUCT", product_id)
            categories[key] = ("PRODUCT_CATEGORY", product_cat) if product_cat else None
            samples[("RECIPE",) + key].append((user_id, grams, created_at))
    return samples, categories


def as_utc(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def compute(conn, settings):
    now = datetime.now(timezone.utc)
    raw, categories = fetch_samples(conn, settings["lookbackDays"])
    raw = {key: [(u, g, as_utc(t)) for u, g, t in rows] for key, rows in raw.items()}
    min_users = int(settings["minUsers"])
    min_samples = settings["minSamples"]
    prior_strength = settings["priorStrength"]

    # 1) Kategori-priors: alle valg i kategorien samlet (samme robuste
    #    typetal), så en ny agurk-variant starter ved "typisk grøntsag".
    category_samples = defaultdict(list)
    for (context, item_type, item_id), rows in raw.items():
        category = categories.get((item_type, item_id))
        if category:
            category_samples[(context,) + category].extend(rows)

    rows_out = []
    priors = {}
    for (context, cat_type, cat_id), rows in category_samples.items():
        stats = summarize(rows, settings, now)
        if not stats or stats["users"] < min_users or stats["n_eff"] < min_samples:
            continue
        priors[(context, cat_type, cat_id)] = stats["median"]
        rows_out.append(
            (cat_type, cat_id, context, stats["median"], confidence(stats["n_eff"], stats["concentration"], prior_strength), stats, "category-median")
        )

    # 2) Varer: typetal, trukket mod kategoriens median ved få data.
    skipped_private = 0
    for (context, item_type, item_id), rows in raw.items():
        stats = summarize(rows, settings, now)
        if not stats:
            continue
        if stats["users"] < min_users or stats["n_eff"] < min_samples:
            skipped_private += 1
            continue
        category = categories.get((item_type, item_id))
        prior = priors.get((context,) + category) if category else None
        grams = geometric_blend(stats["mode"], stats["n_eff"], prior, prior_strength)
        method = "mode+category" if prior is not None and prior_strength > 0 else "mode"
        rows_out.append(
            (item_type, item_id, context, grams, confidence(stats["n_eff"], stats["concentration"], prior_strength), stats, method)
        )

    with conn.cursor() as cur:
        cur.execute("DELETE FROM amount_suggestions")
    if rows_out:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO amount_suggestions
                  (id, "itemType", "itemId", context, "suggestedGrams", confidence,
                   "sampleCount", "userCount", "p25Grams", "p75Grams", method, "computedAt")
                VALUES %s
                """,
                [
                    (
                        "as_" + secrets.token_hex(12),
                        item_type,
                        item_id,
                        context,
                        round(grams, 1),
                        conf,
                        stats["samples"],
                        stats["users"],
                        round(stats["p25"], 1),
                        round(stats["p75"], 1),
                        method,
                        now,
                    )
                    for item_type, item_id, context, grams, conf, stats, method in rows_out
                ],
                template="(%s, %s, %s, %s::\"AmountContext\", %s, %s, %s, %s, %s, %s, %s, %s)",
            )
    conn.commit()

    return {
        "items": sum(1 for r in rows_out if not r[0].endswith("_CATEGORY")),
        "categories": sum(1 for r in rows_out if r[0].endswith("_CATEGORY")),
        "tooFewUsers": skipped_private,
        "samples": sum(len(rows) for rows in raw.values()),
    }


# --- styring ---------------------------------------------------------------


def load_config(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO robot_configs (key, settings, "updatedAt")
            VALUES (%s, %s::jsonb, now())
            ON CONFLICT (key) DO NOTHING
            """,
            (ROBOT_KEY, json.dumps(DEFAULT_SETTINGS)),
        )
        cur.execute(
            """
            UPDATE robot_configs SET "heartbeatAt" = now() WHERE key = %s
            RETURNING enabled, settings, "runRequestedAt", "lastRunStartedAt"
            """,
            (ROBOT_KEY,),
        )
        enabled, settings, run_requested_at, last_started = cur.fetchone()
    conn.commit()
    return enabled, sanitize(settings), run_requested_at, last_started


def should_run(enabled, settings, run_requested_at, last_started):
    if run_requested_at and (not last_started or run_requested_at > last_started):
        return True
    if not enabled:
        return False
    if not last_started:
        return True
    elapsed = (datetime.now(timezone.utc) - as_utc(last_started)).total_seconds()
    return elapsed >= settings["intervalMinutes"] * 60


def record(conn, **fields):
    assignments = ", ".join(f'"{name}" = %s' for name in fields)
    with conn.cursor() as cur:
        cur.execute(f"UPDATE robot_configs SET {assignments} WHERE key = %s", (*fields.values(), ROBOT_KEY))
    conn.commit()


def run_once(conn, settings):
    started = time.monotonic()
    record(conn, lastRunStartedAt=datetime.now(timezone.utc), lastRunStatus="RUNNING", lastError=None)
    try:
        summary = compute(conn, settings)
    except Exception as error:  # noqa: BLE001 — status skal altid skrives
        conn.rollback()
        log.exception("amount suggestion run failed")
        record(
            conn,
            lastRunFinishedAt=datetime.now(timezone.utc),
            lastRunStatus="FAILED",
            lastError=str(error)[:2000],
        )
        return
    summary["durationMs"] = int((time.monotonic() - started) * 1000)
    log.info("amount suggestions updated: %s", summary)
    record(
        conn,
        lastRunFinishedAt=datetime.now(timezone.utc),
        lastRunStatus="OK",
        lastRunSummary=json.dumps(summary),
    )


def main():
    log.info("amount-suggestion-agent started (tick=%ss)", TICK_SECONDS)
    conn = None
    while True:
        try:
            if conn is None or conn.closed:
                conn = psycopg2.connect(DATABASE_URL)
            enabled, settings, run_requested_at, last_started = load_config(conn)
            if should_run(enabled, settings, run_requested_at, last_started):
                run_once(conn, settings)
        except psycopg2.Error:
            log.exception("database error, reconnecting")
            try:
                if conn is not None:
                    conn.close()
            except psycopg2.Error:
                pass
            conn = None
        time.sleep(TICK_SECONDS)


if __name__ == "__main__":
    main()
