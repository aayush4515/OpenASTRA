"""SQLite lifecycle. Foreign keys and WAL are enabled for every connection."""

import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    if not url.startswith("sqlite:"):
        raise ValueError("ASTRA supports SQLite exclusively")
    engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def configure(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=5000")

    return engine


DB_PATH = Path(__file__).resolve().parents[1] / "astra.db"
engine = make_engine(os.environ.get("ASTRA_DATABASE_URL", f"sqlite:///{DB_PATH}"))
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
