"""Database query helpers.

SQL must never be built with f-strings or string interpolation. Always use
``%s`` placeholders and pass parameters as a separate argument so psycopg
can safely escape them (preventing SQL injection).
"""

from contextlib import contextmanager
from psycopg.rows import dict_row

from app.db.pool import get_pool


def fetch_one(sql, params=(), conn=None):
    """Execute a query and return the first row as a dict, or None.

    Args:
        sql: SQL query string with ``%s`` placeholders.
        params: Query parameters (tuple or dict).
        conn: Optional connection to use. If omitted, one is borrowed from
            the pool and returned when done.
    """
    if conn is not None:
        conn.row_factory = dict_row
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()
    with get_pool().connection() as conn:
        conn.row_factory = dict_row
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()


def fetch_all(sql, params=(), conn=None):
    """Execute a query and return all rows as a list of dicts.

    Args:
        sql: SQL query string with ``%s`` placeholders.
        params: Query parameters (tuple or dict).
        conn: Optional connection to use. If omitted, one is borrowed from
            the pool and returned when done.
    """
    if conn is not None:
        conn.row_factory = dict_row
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    with get_pool().connection() as conn:
        conn.row_factory = dict_row
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()


def execute(sql, params=(), conn=None):
    """Execute a statement with no result set (INSERT/UPDATE/DELETE/etc.).

    Args:
        sql: SQL statement string with ``%s`` placeholders.
        params: Query parameters (tuple or dict).
        conn: Optional connection to use. If omitted, one is borrowed from
            the pool and returned when done.
    """
    if conn is not None:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        return
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)


@contextmanager
def transaction():
    """Context manager yielding a connection inside a transaction.

    Commits when the block exits normally; rolls back if an exception escapes.

    Example::

        with transaction() as conn:
            execute("INSERT INTO users (name) VALUES (%s)", ("ada",), conn=conn)

    Yields:
        A psycopg connection object.
    """
    with get_pool().connection() as conn:
        conn.row_factory = dict_row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise