"""Database connection pool.

Holds a single module-level :class:`psycopg_pool.ConnectionPool` created by
``init_pool``. All query helpers borrow connections from this pool so route
code never opens a connection by hand.
"""

from psycopg_pool import ConnectionPool

_pool = None


def init_pool(database_url):
    """Create and store the module-level connection pool.

    Args:
        database_url: PostgreSQL connection URL.
    """
    global _pool
    _pool = ConnectionPool(
        database_url,
        min_size=1,
        max_size=5,
    )


def get_pool():
    """Return the module-level connection pool.

    Raises:
        RuntimeError: If the pool has not been initialized yet.
    """
    if _pool is None:
        raise RuntimeError("Connection pool not initialized. Call init_pool() first.")
    return _pool


def close_pool():
    """Close all connections in the pool. Useful for tests and shutdown."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None