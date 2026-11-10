"""Flask application factory.

create_app() builds and configures the Flask application instance and
registers all blueprints. Using a factory (instead of a module-level
``app = Flask(__name__)``) lets us create multiple app instances (e.g. for
tests or different configs) and avoids circular import issues.
"""

from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.routes.auth import auth as auth_blueprint
from app.routes.profile import profile
from app.routes.health import health


def create_app(test_config=None):
    """Construct and configure the Flask application.

    Args:
        test_config: Optional dict of configuration overrides applied on top
            of the environment-based Config. Intended for tests.

    Returns:
        Flask: The configured application instance.

    Raises:
        RuntimeError: If a required environment variable is missing or empty.
    """
    # Refuse to start if a required setting is missing.
    Config.validate()

    app = Flask(__name__)

    # Load configuration from the environment-backed Config class.
    app.config.from_mapping(
        DATABASE_URL=Config.DATABASE_URL,
        TEST_DATABASE_URL=Config.TEST_DATABASE_URL,
        JWT_SECRET=Config.JWT_SECRET,
        JWT_EXPIRES_MINUTES=Config.JWT_EXPIRES_MINUTES,
        TELEGRAM_BOT_TOKEN=Config.TELEGRAM_BOT_TOKEN,
        CORS_ORIGINS=Config.CORS_ORIGINS,
    )

    # Apply test overrides on top (tests can replace DATABASE_URL, etc.).
    if test_config:
        app.config.from_mapping(test_config)

    # Enable CORS using CORS_ORIGINS split on commas. Never the wildcard "*".
    cors_origins = [
        origin.strip() for origin in app.config["CORS_ORIGINS"].split(",") if origin.strip()
    ]
    CORS(app, origins=cors_origins)

    # Initialize the database connection pool using the configured DATABASE_URL
    # (test_config overrides are already applied above, so tests get their own URL).
    from app.db.pool import init_pool

    init_pool(app.config["DATABASE_URL"])

    # Register blueprints.
    app.register_blueprint(auth_blueprint)
    app.register_blueprint(profile)
    app.register_blueprint(health)

    return app