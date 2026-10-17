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
import os
import time
import uuid
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


# Robot-QoS (docs/DECISIONS.md 2026-10-17, src/lib/robot-qos.ts — hold dem ens):
# et forfaldent job starter først, når værtens CPU og RAM er under admins
# grænser og klokken ikke er i en spærretid. "Kør nu" går altid udenom.
# Indstillingen ligger i robot_configs (key "qos"); /proc viser hele
# Synology'ens tal, også inde fra containeren.
QOS_KEY = "qos"


def _cpu_times():
    try:
        with open("/proc/stat", encoding="utf-8") as handle:
            values = [int(v) for v in handle.readline().split()[1:]]
    except (OSError, ValueError):
        return None
    if len(values) < 4:
        return None
    return values[3] + (values[4] if len(values) > 4 else 0), sum(values)


def _cpu_percent(sample_seconds=1.0):
    first = _cpu_times()
    if first:
        time.sleep(sample_seconds)
        second = _cpu_times()
        if second and second[1] > first[1]:
            return (1 - (second[0] - first[0]) / (second[1] - first[1])) * 100
    try:
        return min(100.0, os.getloadavg()[0] / (os.cpu_count() or 1) * 100)
    except OSError:
        return None


def _memory_percent():
    try:
        with open("/proc/meminfo", encoding="utf-8") as handle:
            info = {line.split(":")[0]: int(line.split()[1]) for line in handle if line.split()[1:2]}
        if info.get("MemTotal") and "MemAvailable" in info:
            return (1 - info["MemAvailable"] / info["MemTotal"]) * 100
    except (OSError, ValueError, IndexError):
        pass
    return None


def _minutes(value):
    try:
        hour, minute = (int(part) for part in str(value).split(":"))
    except ValueError:
        return None
    return hour * 60 + minute if 0 <= hour < 24 and 0 <= minute < 60 else None


def qos_block_reason(settings, cpu, memory, now=None):
    """Hvorfor en robot ikke må starte nu, eller None."""
    local_now = _local(now or _utc_now())
    minute = local_now.hour * 60 + local_now.minute
    for window in settings.get("blockedWindows") or []:
        start, end = _minutes(window.get("start")), _minutes(window.get("end"))
        if start is None or end is None or start == end:
            continue
        inside = start <= minute < end if start < end else (minute >= start or minute < end)
        if inside:
            return "Spærretid %s–%s" % (window.get("start"), window.get("end"))
    max_cpu = settings.get("maxCpuPercent")
    if max_cpu is not None and cpu is not None and cpu > max_cpu:
        return "CPU %d %% (grænse %d %%)" % (round(cpu), max_cpu)
    max_memory = settings.get("maxMemoryPercent")
    if max_memory is not None and memory is not None and memory > max_memory:
        return "RAM %d %% (grænse %d %%)" % (round(memory), max_memory)
    return None


def _qos_wait(conn, key):
    """Venter jobbet på QoS? Skriver i så fald grunden på jobrækken."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT enabled, settings FROM robot_configs WHERE key = %s", (QOS_KEY,))
            row = cur.fetchone()
        conn.rollback()
        if not row or not row[0]:
            return False
        settings = row[1] if isinstance(row[1], dict) else {}
        settings.setdefault("maxCpuPercent", 80)
        settings.setdefault("maxMemoryPercent", 85)
        reason = qos_block_reason(settings, _cpu_percent(), _memory_percent())
        if not reason:
            return False
        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE scheduled_jobs SET "qosWaitingSince" = COALESCE("qosWaitingSince", {UTC_NOW}),
                       "qosWaitReason" = %s WHERE key = %s""",
                (reason, key),
            )
        conn.commit()
        return True
    except Exception:  # noqa: BLE001 - QoS må aldrig stoppe et job (fx før migrationen)
        conn.rollback()
        log.exception("QoS-tjek fejlede for %s", key)
        return False


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
    conn.rollback()
    manual = row[3] is not None and (row[4] is None or row[3] > row[4])
    if not manual and _qos_wait(conn, key):
        return False
    with conn.cursor() as cur:
        cur.execute(
            f"""UPDATE scheduled_jobs SET "lastStartedAt" = {UTC_NOW}, "runRequestedAt" = NULL
                WHERE key = %s AND "lastStartedAt" IS NOT DISTINCT FROM %s""",
            (key, row[4]),
        )
        claimed = cur.rowcount == 1
    conn.commit()
    if claimed:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE scheduled_jobs SET "qosWaitingSince" = NULL, "qosWaitReason" = NULL
                       WHERE key = %s AND "qosWaitingSince" IS NOT NULL""",
                    (key,),
                )
            conn.commit()
        except Exception:  # noqa: BLE001 - fx før QoS-migrationen er kørt
            conn.rollback()
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
        # Kørselstid i admin → Log → Cron (kun rigtige kørsler: >= 1 s eller fejl,
        # så "Løbende" job der ikke havde noget at lave ikke fylder loggen).
        if status != "OK" or (duration_ms or 0) >= 1000:
            try:
                cur.execute(
                    f"""INSERT INTO debug_logs (id, "createdAt", category, event, level, "durationMs", message)
                        SELECT %s, {UTC_NOW}, 'cron', %s, %s, %s, %s
                        WHERE COALESCE((SELECT enabled FROM debug_log_settings WHERE id = 'default'), true)""",
                    (uuid.uuid4().hex, key[:64], "info" if status == "OK" else "error", duration_ms, (message or "OK")[:500]),
                )
            except Exception:  # noqa: BLE001 - logging must never break a job
                conn.rollback()
                log.exception("could not write run log for %s", key)
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
