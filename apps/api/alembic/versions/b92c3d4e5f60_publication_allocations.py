"""Retry-safe rehearsal allocation receipts and retained purge tombstones."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = "b92c3d4e5f60"
down_revision = "a91b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("publication_allocations",
        sa.Column("identity_hash", sa.String(64), primary_key=True),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("asset_versions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("receipt", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade():
    op.drop_table("publication_allocations")
