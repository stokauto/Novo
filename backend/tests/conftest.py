"""
Ensure backend/.env is loaded for unit tests that import push_utils/server
outside the running uvicorn process.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env (VAPID keys, MONGO_URL, DB_NAME) before any test module
# imports push_utils. supervisor already loads these for the server process,
# but pytest runs in its own environment.
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH, override=False)
