"""Validate a comment anchor against this version's immutable timeline."""
from fastapi import HTTPException
from ..models.rehearsal import RehearsalMetadataRecord
from ..schemas.rehearsal import RehearsalMetadata


def validate_anchor(db, body, version_id=None):
    frame, cue, metadata_hash = body.clip_frame, body.cue_occurrence_id, body.rehearsal_metadata_hash
    if frame is None and cue is None and metadata_hash is None:
        return {}
    if frame is None or metadata_hash is None:
        raise HTTPException(status_code=422, detail="Frame and rehearsal metadata hash are required together")
    record = db.query(RehearsalMetadataRecord).filter(RehearsalMetadataRecord.version_id == (version_id or body.version_id)).first()
    if record is None or record.metadata_hash != metadata_hash:
        raise HTTPException(status_code=409, detail="Rehearsal metadata no longer matches this version")
    metadata = RehearsalMetadata.model_validate(record.payload)
    if not 0 <= int(frame) < int(metadata.frame_count):
        raise HTTPException(status_code=422, detail="Comment frame is outside this clip")
    if cue is not None:
        occurrence = next((c for c in metadata.cues if c.id == cue), None)
        if occurrence is None or occurrence.clip_frame != frame:
            raise HTTPException(status_code=422, detail="Cue occurrence does not match this frame")
    seconds = int(frame) / metadata.video_rate.fraction()
    return {"clip_frame": int(frame), "cue_occurrence_id": cue,
            "rehearsal_metadata_hash": metadata_hash, "timecode_start": float(seconds)}
