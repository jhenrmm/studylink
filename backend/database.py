"""PostgreSQL connection helpers and schema initialization."""
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor

from backend.config import DATABASE_URL

DATABASE_NAME = "studylink"
ADMIN_DATABASE = "postgres"

_SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS academic_profiles (
        user_id INTEGER PRIMARY KEY
            REFERENCES users(id) ON DELETE CASCADE,
        name TEXT,
        bio TEXT,
        academic_level TEXT,
        subjects TEXT[] NOT NULL DEFAULT '{}',
        interests TEXT[] NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS study_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        subject TEXT NOT NULL,
        creator_id INTEGER NOT NULL
            REFERENCES users(id) ON DELETE CASCADE,
        join_policy TEXT NOT NULL DEFAULT 'open'
            CHECK (join_policy IN ('open', 'approval')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER NOT NULL
            REFERENCES study_groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL
            REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member'
            CHECK (role IN ('admin', 'member')),
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (group_id, user_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS group_join_requests (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL
            REFERENCES study_groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL
            REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        decided_at TIMESTAMPTZ,
        decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS group_join_requests_one_pending
        ON group_join_requests (group_id, user_id) WHERE status = 'pending'
    """,
    # Idempotent upgrade for databases created before the join policy existed.
    """
    ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS join_policy TEXT NOT NULL
        DEFAULT 'open' CHECK (join_policy IN ('open', 'approval'))
    """,
)


def _admin_url() -> str:
    """Return a connection URL for the default admin database."""
    return DATABASE_URL.rsplit("/", 1)[0] + f"/{ADMIN_DATABASE}"


@contextmanager
def db_connection(**options: Any) -> Iterator[psycopg2.extensions.connection]:
    """Yield a connection to the application database and always close it."""
    conn = psycopg2.connect(DATABASE_URL, **options)
    try:
        yield conn
    finally:
        conn.close()


def ensure_database() -> None:
    """Create the studylink database if it does not already exist."""
    conn = psycopg2.connect(_admin_url())
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DATABASE_NAME,))
            if cur.fetchone() is None:
                cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DATABASE_NAME)))
    finally:
        conn.close()


def init_db() -> None:
    """Create the application tables if they do not exist."""
    ensure_database()
    with db_connection() as conn:
        with conn.cursor() as cur:
            for statement in _SCHEMA_STATEMENTS:
                cur.execute(statement)
        conn.commit()


def get_db():
    """Yield a PostgreSQL connection (RealDictCursor) and close it afterwards."""
    with db_connection(cursor_factory=RealDictCursor) as conn:
        yield conn
