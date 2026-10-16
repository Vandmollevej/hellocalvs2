FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent.py job_control.py markets.py ./

CMD ["python", "agent.py"]
