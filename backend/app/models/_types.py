"""Shared column types."""

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB

# JSONB on Postgres, generic JSON elsewhere (keeps unit tests portable).
JSONType = JSON().with_variant(JSONB(), "postgresql")
