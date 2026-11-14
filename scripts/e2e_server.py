"""Run browser acceptance tests against a disposable, isolated SQLite database."""

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

if __name__ == "__main__":
    import uvicorn

    with tempfile.TemporaryDirectory(prefix="astra-e2e-") as directory:
        os.environ["ASTRA_DATABASE_URL"] = f"sqlite:///{directory}/demo.db"
        uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8011)
