"""Immutable rehearsal timeline per asset version; no existing data backfill."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a91b2c3d4e5f'
down_revision = 'e3f5a7c9d1b2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('rehearsal_metadata',
        sa.Column('version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('asset_versions.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('metadata_hash', sa.String(64), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade():
    op.drop_table('rehearsal_metadata')
