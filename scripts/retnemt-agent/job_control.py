"""
Fælles jobstyring for HELLO CALs Python-agenter (admin "Cron-jobs",
docs/DECISIONS.md 2026-09-25).

Hver agent kører i sin egen container som før, men i stedet for at sove et
fast interval spørger den hvert minut tabellen `scheduled_jobs` (samme række
som admin-siden redigerer), om jobbet skal køre nu:

- `enabled` = false → pause (en "kør nu" virker stadig).
- `runRequestedAt` nyere end sidste start → kør nu.
- `intervalMinutes` = 0 → "Løbende": kør ved hvert tjek (fx billedrobotten,
  der hele tiden venter på nye produkter; tjekket er `check_seconds`).
- `intervalMinutes` → kør når der er gået så længe siden sidste start.
- `runAtTime` ("HH:MM", dansk tid) → kør én gang dagligt på det tidspunkt.

Status (start, slut, OK/FEJL, besked, varighed) skrives tilbage, så admin kan
se hvornår jobbet sidst kørte. Hver kørsel gemmes desuden i
`scheduled_job_runs` (admin "Robotter" + oversigtens "Nattens kørsler",
docs/DECISIONS.md 2026-10-02): `job(conn)` må returnere enten en besked
(str) eller `(besked, antal)`, hvor antal er hvor meget kørslen udførte
(varer, billeder, opskrifter …). Tomme OK-kørsler (0 udført) lægges sammen
med forrige række, hvis den også var tom, så "Løbende" jobs ikke fylder
tabellen med ét tjek pr. 15 s. Denne fil findes i én kopi pr. agent-mappe,
fordi hver agent bygges som sin egen container — hold kopierne ens
(src/lib/jobs/schedule.ts + src/lib/jobs/runs.ts har samme regler for jobs
i app-processen).
"""

import datetime
import logging
import time
from zoneinfo import ZoneInfo

import psycopg2

log = logging.getLogger("job-control")

TZ = ZoneInfo("Europe/Copenhagen")
CHECK_SECONDS = 60
UTC_NOW = "(NOW() AT TIME ZONE 'UTC')"


def _utc_now():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _local(naive_utc):
    return naive_utc.replace(tzinfo=datetime.timezone.utc).astimezone(TZ)


def is_due(enabled, run_at_time, interval_minutes, run_requested_at, last_started_at, now=None):
    now = now or _utc_now()
    if run_requested_at and (last_started_at is None or run_requested_at > last_started_at):
        return True
    if not enabled:
        return False
    if interval_minutes == 0:
        return True
    if interval_minutes:
        return last_started_at is None or now - last_started_at >= datetime.timedelta(minutes=interval_minutes)
    if run_at_time:
        try:
            hour, minute = (int(part) for part in run_at_time.split(":"))
        except ValueError:
            return False
        local_now = _local(now)
        scheduled = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if local_now < scheduled:
            return False
        return last_started_at is None or _local(last_started_at) < scheduled
    return last_started_at is None


def _ensure_row(conn, key, interval_minutes, run_at_time):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO scheduled_jobs (key, enabled, "intervalMinutes", "runAtTime")
            VALUES (%s, true, %s, %s)
            ON CONFLICT (key) DO NOTHING
            """,
            (key, interval_minutes, run_at_time),
        )
    conn.commit()


def _claim(conn, key):
    """Returnerer True hvis jobbet er forfaldent og nu er markeret som startet."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT enabled, "runAtTime", "intervalMinutes", "runRequestedAt", "lastStartedAt"
               FROM scheduled_jobs WHERE key = %s""",
            (key,),
        )
        row = cur.fetchone()
        if not row or not is_due(*row):
            conn.rollback()
            return False
        cur.execute(
            f"""UPDATE scheduled_jobs SET "lastStartedAt" = {UTC_NOW}, "runRequestedAt" = NULL
                WHERE key = %s AND "lastStartedAt" IS NOT DISTINCT FROM %s""",
            (key, row[4]),
        )
        claimed = cur.rowcount == 1
    conn.commit()
    return claimed


def _normalize_result(result):
    """str | None | (besked, antal) -> (besked, antal)."""
    if result is None:
        return "OK", 0
    if isinstance(result, tuple):
        message = result[0] if result else None
        count = result[1] if len(result) > 1 and result[1] is not None else 0
        return (str(message) if message else "OK"), max(0, int(count))
    return (str(result) or "OK"), 0


def _record_run(cur, key, started_at, status, message, item_count, duration_ms):
    idle = status == "OK" and item_count == 0
    if idle:
        cur.execute(
            f"""UPDATE scheduled_job_runs
                SET "finishedAt" = {UTC_NOW}, message = %s, "runCount" = "runCount" + 1,
                    "durationMs" = "durationMs" + %s
                WHERE id = (SELECT id FROM scheduled_job_runs WHERE "jobKey" = %s
                            ORDER BY "finishedAt" DESC LIMIT 1)
                  AND status = 'OK' AND "itemCount" = 0""",
            (message, duration_ms, key),
        )
        if cur.rowcount == 1:
            return
    cur.execute(
        f"""INSERT INTO scheduled_job_runs
                (id, "jobKey", "startedAt", "finishedAt", status, message, "itemCount", "runCount", "durationMs")
            VALUES (gen_random_uuid()::text, %s, %s, {UTC_NOW}, %s, %s, %s, 1, %s)""",
        (key, started_at, status, message, item_count, duration_ms),
    )


def _finish(conn, key, started_at, status, message, item_count, duration_ms):
    message = (message or "")[:1000]
    with conn.cursor() as cur:
        cur.execute(
            f"""UPDATE scheduled_jobs
                SET "lastRunAt" = {UTC_NOW}, "lastStatus" = %s, "lastMessage" = %s, "lastDurationMs" = %s
                WHERE key = %s""",
            (status, message, duration_ms, key),
        )
    conn.commit()
    # Historikken må aldrig vælte selve jobbet (fx før migrationen er kørt).
    try:
        with conn.cursor() as cur:
            _record_run(cur, key, started_at, status, message, item_count, duration_ms)
        conn.commit()
    except Exception:  # noqa: BLE001
        conn.rollback()
        log.exception("job %s: kørslen kunne ikke gemmes i scheduled_job_runs", key)


def _request_run(conn, key):
    with conn.cursor() as cur:
        cur.execute(
            f"""UPDATE scheduled_jobs SET "runRequestedAt" = {UTC_NOW} WHERE key = %s AND enabled""",
            (key,),
        )
    conn.commit()


def run_forever(database_url, key, job, interval_minutes=None, run_at_time=None, run_on_start=False, check_seconds=CHECK_SECONDS):
    """Kører `job(conn)` hver gang admin-planen siger det. `job` må returnere
    en kort statusbesked eller `(besked, antal udført)` (vises på admin-siden
    og i "Nattens kørsler"). run_on_start: kør også én gang
    ved hver container-start (fx efter en deploy med nye data), medmindre
    jobbet er pauset. check_seconds: hvor tit planen tjekkes (og dermed hvor
    tit et "Løbende" job kører)."""
    log.info("job %s under admin-styring (standard: interval=%s min, tidspunkt=%s)", key, interval_minutes, run_at_time)
    ensured = False
    while True:
        conn = None
        try:
            conn = psycopg2.connect(database_url)
            if not ensured:
                _ensure_row(conn, key, interval_minutes, run_at_time)
                if run_on_start:
                    _request_run(conn, key)
                ensured = True
            if _claim(conn, key):
                started = time.monotonic()
                started_at = _utc_now()
                try:
                    message, item_count = _normalize_result(job(conn))
                    conn.commit()
                    _finish(conn, key, started_at, "OK", message, item_count, int((time.monotonic() - started) * 1000))
                except Exception as error:  # noqa: BLE001 - a broken cycle must not kill the service
                    conn.rollback()
                    log.exception("job %s failed", key)
                    _finish(conn, key, started_at, "ERROR", str(error), 0, int((time.monotonic() - started) * 1000))
        except Exception:  # noqa: BLE001 - e.g. database briefly unavailable
            log.exception("job control cycle failed for %s", key)
        finally:
            if conn is not None:
                conn.close()
        time.sleep(check_seconds)
