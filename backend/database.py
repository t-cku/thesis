import os
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./thesis.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_sqlite_user_columns() -> None:
    """Add verification columns to existing SQLite DBs created before this feature."""
    if not DATABASE_URL.startswith("sqlite"):
        return

    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("users")}
    alterations = []

    if "email_verified" not in existing:
        alterations.append(
            "ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 0"
        )
    if "verification_token" not in existing:
        alterations.append("ALTER TABLE users ADD COLUMN verification_token VARCHAR(128)")
    if "verification_token_expires" not in existing:
        alterations.append(
            "ALTER TABLE users ADD COLUMN verification_token_expires DATETIME"
        )

    if not alterations:
        return

    with engine.begin() as connection:
        for statement in alterations:
            connection.execute(text(statement))


def init_db() -> None:
    from backend import db_models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_user_columns()
