"""
Structured logging setup.

Outputs clean, structured logs — JSON in production, human-readable in development.
Attach a log_context() call anywhere you want to enrich log records with request-scoped
metadata (request_id, user_id, etc.) without threading issues.
"""
import logging
import sys
from contextvars import ContextVar
from typing import Any, Dict, Optional

# Context variable to hold per-request metadata (e.g. request_id)
_log_context: ContextVar[Dict[str, Any]] = ContextVar("log_context", default={})


class ContextFilter(logging.Filter):
    """Injects context-var fields into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        ctx = _log_context.get({})
        for key, value in ctx.items():
            setattr(record, key, value)
        return True


def set_log_context(**kwargs: Any) -> None:
    """Set request-scoped fields that will appear in all subsequent log lines."""
    current = _log_context.get({}).copy()
    current.update(kwargs)
    _log_context.set(current)


def clear_log_context() -> None:
    _log_context.set({})


class _DevFormatter(logging.Formatter):
    """Colourised, human-readable formatter for development."""

    LEVEL_COLOURS = {
        logging.DEBUG: "\033[36m",     # cyan
        logging.INFO: "\033[32m",      # green
        logging.WARNING: "\033[33m",   # yellow
        logging.ERROR: "\033[31m",     # red
        logging.CRITICAL: "\033[35m",  # magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        colour = self.LEVEL_COLOURS.get(record.levelno, self.RESET)
        level = f"{colour}{record.levelname:<8}{self.RESET}"
        base = f"{self.formatTime(record, '%H:%M:%S')}  {level}  {record.name}  {record.getMessage()}"

        # Append any context-var extras
        extras = {
            k: getattr(record, k)
            for k in vars(record)
            if k not in logging.LogRecord.__dict__
            and not k.startswith("_")
            and k not in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            )
        }
        if extras:
            base += "  " + "  ".join(f"{k}={v}" for k, v in extras.items())

        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)

        return base


def setup_logging(
    level: Optional[str] = None,
    *,
    env: str = "development",
) -> None:
    """
    Configure the root logger.  Call once at application startup.

    Args:
        level: Override log level string (DEBUG / INFO / WARNING / ERROR).
        env:   'production' → JSON-style formatting; anything else → colourised dev format.
    """
    from app.config import settings  # avoid circular import at module load time

    resolved_level = getattr(logging, (level or settings.LOG_LEVEL).upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(ContextFilter())

    if settings.ENV == "production":
        # In production you'd typically wire in python-json-logger or similar.
        # Here we use a compact JSON-ish format that ships well to log aggregators.
        fmt = (
            '{"time":"%(asctime)s","level":"%(levelname)s",'
            '"logger":"%(name)s","msg":"%(message)s"}'
        )
        handler.setFormatter(logging.Formatter(fmt, datefmt="%Y-%m-%dT%H:%M:%S"))
    else:
        handler.setFormatter(_DevFormatter())

    root = logging.getLogger()
    root.setLevel(resolved_level)

    # Remove any pre-existing handlers (e.g. from uvicorn's default setup)
    root.handlers.clear()
    root.addHandler(handler)

    # Quiet noisy third-party loggers
    for noisy in ("httpcore", "httpx", "anthropic"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        "Logging initialised",
        extra={"level": logging.getLevelName(resolved_level), "env": settings.ENV},
    )
