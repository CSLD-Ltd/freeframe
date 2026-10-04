"""Immutable metadata storage; callers must hold the corresponding version row lock."""
import hashlib
import json
from fastapi import HTTPException
from ..models.rehearsal import RehearsalMetadataRecord
from ..schemas.rehearsal import RehearsalMetadata


def store(db, version_id, payload):
    validated = RehearsalMetadata.model_validate(payload).model_dump(mode='json')
    canonical = json.dumps(validated, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()
    if len(canonical) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail='Rehearsal metadata exceeds 8 MiB')
    digest = hashlib.sha256(canonical).hexdigest()
    existing = db.query(RehearsalMetadataRecord).filter(RehearsalMetadataRecord.version_id == version_id).first()
    if existing:
        if existing.metadata_hash != digest:
            raise HTTPException(status_code=409, detail='Version rehearsal metadata is immutable; publish a new version')
        return existing
    record = RehearsalMetadataRecord(version_id=version_id, metadata_hash=digest, payload=validated)
    db.add(record)
    db.flush()
    return record
