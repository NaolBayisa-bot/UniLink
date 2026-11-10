"""WSGI entry point.

Exposes a module-level ``app`` object created by the application factory so
that WSGI servers (e.g. gunicorn) can import it via ``gunicorn wsgi:app``.
The Flask development server also uses it via ``flask --app wsgi run``.
"""

from app import create_app

app = create_app()