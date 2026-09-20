FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# CPU-only torch wheel — this agent has no GPU on the target Synology NAS
# (see docs/DEPLOYMENT.md); the default PyPI wheel pulls in ~2GB of unused
# CUDA libraries.
RUN pip install --no-cache-dir torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY agent.py .
CMD ["python", "agent.py"]
