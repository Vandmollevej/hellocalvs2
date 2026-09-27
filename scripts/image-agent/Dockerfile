FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# rembg's u2net-model (176 MB) bages ind i imaget. Ellers hentes den ved den
# første fritskrabning efter hver genstart af containeren (test 2026-09-27:
# ca. 1 minut ekstra, før brugerens første logo/produktbillede er klar).
ENV U2NET_HOME=/models
RUN python -c "from rembg import new_session; new_session('u2net')"

COPY agent.py cutout.py job_control.py ./

CMD ["python", "agent.py"]
