"""Exact rehearsal frame/cue anchors; ordinary comments remain unchanged."""
from alembic import op
import sqlalchemy as sa
revision = "c03d4e5f6071"
down_revision = "b92c3d4e5f60"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("comments", sa.Column("clip_frame", sa.BigInteger(), nullable=True))
    op.add_column("comments", sa.Column("cue_occurrence_id", sa.String(128), nullable=True))
    op.add_column("comments", sa.Column("rehearsal_metadata_hash", sa.String(64), nullable=True))


def downgrade():
    for name in ("rehearsal_metadata_hash", "cue_occurrence_id", "clip_frame"):
        op.drop_column("comments", name)
