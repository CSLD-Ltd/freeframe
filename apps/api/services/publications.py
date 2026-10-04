"""Serialize allocation and replay its receipt when a response was lost."""
import hashlib
import json
import uuid
from fastapi import HTTPException
from sqlalchemy import text
from ..models.publication import PublicationAllocation
from ..models.asset import Asset, AssetType
from ..routers.upload import allocate_upload


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def allocate(db, user, body):
    identity = [str(user.id), str(body.project_id), str(body.producer_id), body.recording_id, body.take_id, body.export_id]
    identity_hash = digest(identity)
    request_hash = digest(body.model_dump(mode="json"))
    # PostgreSQL transaction lock also serializes independent API processes.
    lock_id = int.from_bytes(bytes.fromhex(identity_hash)[:8], "big", signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_id})
    row = db.query(PublicationAllocation).filter(PublicationAllocation.identity_hash == identity_hash).first()
    if row is not None:
        if row.request_hash != request_hash:
            raise HTTPException(status_code=409, detail="Publication identity already belongs to another export")
        if row.version_id is None:
            raise HTTPException(status_code=410, detail="Publication has been purged")
        return row.receipt
    # Replay/tombstones win before target validation; only fresh uploads allocate storage.
    if body.asset_id is not None:
        target = db.query(Asset).filter(Asset.id == body.asset_id,
            Asset.project_id == body.project_id, Asset.deleted_at.is_(None)).first()
        if target is None:
            raise HTTPException(status_code=404, detail="Asset not found")
        if target.asset_type != AssetType.video:
            raise HTTPException(status_code=422, detail="Rehearsal publication requires a video asset")
    receipt = allocate_upload(body, db, user).model_dump(mode="json")
    db.add(PublicationAllocation(identity_hash=identity_hash, request_hash=request_hash,
        version_id=uuid.UUID(receipt["version_id"]), receipt=receipt))
    db.flush()
    return receipt
