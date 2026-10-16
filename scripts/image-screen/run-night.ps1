# Starter nattens screening (kør i PowerShell; sæt DATABASE_URL og IMAGE_BASE_URL først).
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python screen.py --max-hours 8
