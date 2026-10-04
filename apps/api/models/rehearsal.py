import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
try:
    from ..database import Base
except ImportError:
    from database import Base


class RehearsalMetadataRecord(Base):
    __tablename__ = 'rehearsal_metadata'
    version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('asset_versions.id', ondelete='CASCADE'), primary_key=True)
    metadata_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
