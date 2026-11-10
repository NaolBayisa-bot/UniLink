"""Application configuration sourced from environment variables.

Calls load_dotenv() so variables defined in .env are available via os.environ.
Defines a Config class holding all settings. Required variables are validated
with Config.validate(); the application refuses to start if any are missing.
"""

import os
from dotenv import load_dotenv

# Load variables from .env into the environment (no-op if file is absent).
load_dotenv()


class Config:
    """Configuration read from environment variables.

    Required (missing or empty => RuntimeError at startup):
        DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN

    Optional with defaults:
        JWT_EXPIRES_MINUTES -> 60
        CORS_ORIGINS -> http://localhost:5173

    Optional, NOT required at startup (only tests need it):
        TEST_DATABASE_URL
    """

    # Required
    DATABASE_URL = os.environ.get("DATABASE_URL", "")
    JWT_SECRET = os.environ.get("JWT_SECRET", "")
    TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")

    # Optional with defaults
    JWT_EXPIRES_MINUTES = os.environ.get("JWT_EXPIRES_MINUTES", "60")
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173")

    # Optional; tests only. Deliberately not required here.
    TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")

    @classmethod
    def validate(cls):
        """Ensure all required environment variables are present and non-empty.

        Raises:
            RuntimeError: Listing every missing/empty required variable name.
        """
        required = ("DATABASE_URL", "JWT_SECRET", "TELEGRAM_BOT_TOKEN")
        missing = [name for name in required if not getattr(cls, name)]
        if missing:
            raise RuntimeError(
                "Missing required environment variables: "
                + ", ".join(missing)
                + ". Copy .env.example to .env and fill in the real values."
            )