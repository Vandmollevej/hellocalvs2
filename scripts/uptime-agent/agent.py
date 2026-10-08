"""
HELLO CAL vagt-robot (docs/DEPLOYMENT.md "Overvågning", docs/DECISIONS.md 2026-10-08).

Tjekker hver time (CHECK_INTERVAL_SECONDS) fra NAS'en:
  - hellocal.io udefra (via Cloudflare-tunnelen): /api/health?deep=1
  - appen indefra (uden om tunnelen), så mailen siger, om fejlen er tunnel eller app
  - alle hellocal-v2-containere kører og er ikke "unhealthy" (Docker-socket, kun læsning)
  - ledig diskplads på /volume1

Sender mail til ALERT_EMAIL, når et tjek går fra ok til fejl, en påmindelse
hver REMIND_HOURS, mens det stadig fejler, og en "løst"-mail, når det virker
igen. SMTP læses som appen: .env-værdier, overskrevet af admin-gemte nøgler i
app_secrets (src/lib/api-keys/store.ts). Supplerer GitHub-tjekket
(.github/workflows/uptime.yml), som også virker, når hele NAS'en er nede.
"""

import base64
import http.client
import json
import logging
import os
import shutil
import smtplib
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage

import psycopg2
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("uptime-agent")

DATABASE_URL = os.environ.get("DATABASE_URL", "").split("?")[0]
ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "").strip()
CHECK_INTERVAL_SECONDS = int(os.environ.get("CHECK_INTERVAL_SECONDS", "3600"))
REMIND_HOURS = float(os.environ.get("REMIND_HOURS", "6"))
PUBLIC_URL = os.environ.get("PUBLIC_HEALTH_URL", "https://hellocal.io/api/health?deep=1")
INTERNAL_URL = os.environ.get("INTERNAL_HEALTH_URL", "http://app:3000/api/health?deep=1")
COMPOSE_PROJECT = os.environ.get("COMPOSE_PROJECT", "hellocal-v2")
DISK_PATH = os.environ.get("DISK_PATH", "/volume")
DISK_MIN_FREE_PERCENT = float(os.environ.get("DISK_MIN_FREE_PERCENT", "10"))
DOCKER_SOCKET = "/var/run/docker.sock"
# Engangs-services, der normalt står som afsluttede.
ONE_SHOT_SERVICES = {"migrate", "rema1000-agent", "umami-db-init"}
SMTP_KEYS = ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM")


# --- Tjek ---------------------------------------------------------------------

def check_http(url):
    """None = ok, ellers en kort fejltekst."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "hellocal-uptime-agent"}), timeout=30) as resp:
            return None if resp.status == 200 else f"HTTP {resp.status}"
    except urllib.error.HTTPError as err:
        body = err.read(300).decode("utf-8", "replace")
        return f"HTTP {err.code} {body}".strip()
    except Exception as err:  # noqa: BLE001 — netværksfejl af alle slags er netop det, vi melder
        return f"{type(err).__name__}: {err}"


class DockerConnection(http.client.HTTPConnection):
    def __init__(self):
        super().__init__("localhost", timeout=20)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(20)
        self.sock.connect(DOCKER_SOCKET)


def check_containers():
    """Containere i projektet med restart-politik, der ikke kører eller er unhealthy."""
    if not os.path.exists(DOCKER_SOCKET):
        return "Docker-socket ikke monteret"
    conn = DockerConnection()
    try:
        label = json.dumps({"label": [f"com.docker.compose.project={COMPOSE_PROJECT}"]})
        conn.request("GET", "/containers/json?all=1&filters=" + urllib.parse.quote(label))
        containers = json.loads(conn.getresponse().read())
    except Exception as err:  # noqa: BLE001
        return f"Docker svarer ikke: {err}"
    finally:
        conn.close()

    problems = []
    for c in containers:
        name = (c.get("Names") or ["?"])[0].lstrip("/")
        service = c.get("Labels", {}).get("com.docker.compose.service", "")
        state = c.get("State", "")
        status = c.get("Status", "")
        # Engangs-services (migrate, rema1000-agent, umami-db-init) og "Created"-
        # kopier fra en afbrudt udrulning skal ikke køre.
        if state == "created" or (state == "exited" and service in ONE_SHOT_SERVICES):
            continue
        if state != "running":
            problems.append(f"{name}: {status or state}")
        elif "unhealthy" in status:
            problems.append(f"{name}: unhealthy")
    return "; ".join(problems) or None


def check_disk():
    try:
        usage = shutil.disk_usage(DISK_PATH)
    except OSError as err:
        return f"Kan ikke læse diskplads: {err}"
    free = usage.free / usage.total * 100
    if free < DISK_MIN_FREE_PERCENT:
        return f"kun {free:.1f} % ledig ({usage.free / 1e9:.0f} GB af {usage.total / 1e9:.0f} GB)"
    return None


CHECKS = [
    ("hellocal.io udefra", lambda: check_http(PUBLIC_URL)),
    ("Appen indefra (uden Cloudflare)", lambda: check_http(INTERNAL_URL)),
    ("Containere", check_containers),
    ("Diskplads", check_disk),
]


# --- Mail ---------------------------------------------------------------------

_smtp_cache = {}


def _app_secret_key():
    master = os.environ.get("ADMIN_SESSION_SECRET", "")
    if len(master) < 16:
        return None
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"hellocal-app-secrets", info=b"api-keys-v1").derive(master.encode())


def _decrypt(cipher_text, key):
    raw = base64.b64decode(cipher_text[3:])
    iv, tag, data = raw[:12], raw[12:28], raw[28:]
    return AESGCM(key).decrypt(iv, data + tag, None).decode("utf-8")


def smtp_settings():
    """Samme forrang som appen: admin-gemt værdi vinder over .env. Sidste gode sæt huskes, hvis databasen er nede."""
    settings = {k: os.environ.get(k, "").strip() for k in SMTP_KEYS}
    key = _app_secret_key()
    if key and DATABASE_URL:
        try:
            with psycopg2.connect(DATABASE_URL, connect_timeout=10) as conn, conn.cursor() as cur:
                cur.execute('SELECT key, "cipherText" FROM app_secrets WHERE key = ANY(%s)', (list(SMTP_KEYS),))
                for name, cipher_text in cur.fetchall():
                    try:
                        settings[name] = _decrypt(cipher_text, key).strip()
                    except Exception:  # noqa: BLE001 — ulæselig række: .env-værdien gælder
                        log.warning("Kunne ikke dekryptere %s", name)
            _smtp_cache.update(settings)
        except Exception as err:  # noqa: BLE001
            log.warning("Database utilgængelig, bruger sidst kendte SMTP-opsætning: %s", err)
            if _smtp_cache:
                return dict(_smtp_cache)
    return settings


def send_mail(subject, body):
    if not ALERT_EMAIL:
        log.error("ALERT_EMAIL mangler — kan ikke sende: %s", subject)
        return False
    s = smtp_settings()
    if not (s["SMTP_HOST"] and s["SMTP_USER"] and s["SMTP_PASS"]):
        log.error("SMTP er ikke sat op — kan ikke sende: %s", subject)
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = s["SMTP_FROM"] or s["SMTP_USER"]
    msg["To"] = ALERT_EMAIL
    msg.set_content(body)
    try:
        port = int(s["SMTP_PORT"] or 587)
        if port == 465:
            server = smtplib.SMTP_SSL(s["SMTP_HOST"], port, timeout=30)
        else:
            server = smtplib.SMTP(s["SMTP_HOST"], port, timeout=30)
            server.starttls()
        with server:
            server.login(s["SMTP_USER"], s["SMTP_PASS"])
            server.send_message(msg)
        log.info("Mail sendt: %s", subject)
        return True
    except Exception as err:  # noqa: BLE001
        log.error("Mail fejlede (%s): %s", subject, err)
        return False


# --- Løkke --------------------------------------------------------------------

def run_once(state):
    """state: navn -> {"error": str, "since": ts, "last_mail": ts}; kun fejlende tjek står i den."""
    now = time.time()
    failing, recovered = [], []
    for name, check in CHECKS:
        error = check()
        if error:
            log.warning("FEJL %s: %s", name, error)
            entry = state.setdefault(name, {"since": now, "last_mail": 0})
            entry["error"] = error
            failing.append(name)
        else:
            log.info("OK %s", name)
            if name in state:
                recovered.append((name, state.pop(name)))

    due = [n for n in failing if now - state[n]["last_mail"] >= REMIND_HOURS * 3600]
    if due:
        new = [n for n in due if state[n]["last_mail"] == 0]
        lines = []
        for n in failing:
            minutes = int((now - state[n]["since"]) / 60)
            lines.append(f"- {n}: {state[n]['error']} (fejlet i {minutes} min)")
        if new:
            subject = "Hello Cal: PROBLEM — " + ", ".join(new)
        else:
            subject = "Hello Cal: stadig problem — " + ", ".join(due)
        body = "Vagt-robotten på NAS'en fandt fejl:\n\n" + "\n".join(lines) + (
            "\n\nNæste tjek om en time. Du får en mail, når det virker igen."
        )
        if send_mail(subject, body):
            for n in failing:
                state[n]["last_mail"] = now

    mailed_recoveries = [(n, e) for n, e in recovered if e.get("last_mail")]
    if mailed_recoveries:
        lines = [f"- {n}: virker igen (var nede i ca. {int((now - e['since']) / 60)} min)" for n, e in mailed_recoveries]
        send_mail("Hello Cal: løst — " + ", ".join(n for n, _ in mailed_recoveries), "\n".join(lines))


def main():
    log.info("Vagt-robot startet: tjek hver %d s, mail til %s", CHECK_INTERVAL_SECONDS, ALERT_EMAIL or "(ingen)")
    state = {}
    # Lad resten af stakken starte efter en udrulning, før første tjek.
    time.sleep(int(os.environ.get("START_DELAY_SECONDS", "120")))
    # Bekræfter, at mail virker, og fortæller om genstart af NAS'en eller robotten.
    send_mail(
        "Hello Cal: vagt-robot startet",
        "Vagt-robotten på NAS'en er startet (NAS genstartet eller robotten opdateret).\n"
        f"Den tjekker hver {CHECK_INTERVAL_SECONDS // 60} min og mailer kun igen, hvis noget fejler.",
    )
    while True:
        try:
            run_once(state)
        except Exception:  # noqa: BLE001 — robotten må aldrig stoppe
            log.exception("Uventet fejl i tjek-runden")
        time.sleep(CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
