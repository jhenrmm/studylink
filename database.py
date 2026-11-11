"""PostgreSQL connection helpers and schema initialization."""
import psycopg2
from psycopg2.extras import RealDictCursor

from config import DATABASE_URL


def _admin_url() -> str:
    """Return a connection URL for the default 'postgres' database."""
    return DATABASE_URL.rsplit("/", 1)[0] + "/postgres"


def ensure_database() -> None:
    """Create the studylink database if it does not already exist."""
    conn = psycopg2.connect(_admin_url())
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", ("studylink",))
            if cur.fetchone() is None:
                cur.execute("CREATE DATABASE studylink")
    finally:
        conn.close()


def init_db() -> None:
    """Create the users and revoked_tokens tables if they do not exist."""
    ensure_database()
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS revoked_tokens (
                    jti TEXT PRIMARY KEY,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        conn.commit()
    finally:
        conn.close()


def get_db():
    """Yield a PostgreSQL connection (RealDictCursor) and close it afterwards."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()
