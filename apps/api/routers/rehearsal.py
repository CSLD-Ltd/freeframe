"""Authenticated immutable rehearsal metadata, independent of ordinary custom fields."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..middleware.auth import get_current_user, get_optional_user
from ..models.asset import Asset, AssetVersion, AssetType
from ..models.project import Project, ProjectRole
from ..models.user import User
from ..models.rehearsal import RehearsalMetadataRecord
from ..schemas.rehearsal import RehearsalMetadata
from ..services import permissions
from ..services.rehearsal_metadata import store

router = APIRouter(tags=['rehearsal'])


def resolve(db, asset_id, version_id, user, role, lock=False):
    asset = db.query(Asset).join(Project, Project.id == Asset.project_id).filter(Asset.id == asset_id, Asset.deleted_at.is_(None), Project.deleted_at.is_(None)).first()
    if asset is None:
        raise HTTPException(status_code=404, detail='Asset not found')
    permissions.require_project_role(db, asset.project_id, user, role)
    query = db.query(AssetVersion).filter(AssetVersion.id == version_id,
        AssetVersion.asset_id == asset_id, AssetVersion.deleted_at.is_(None))
    if lock:
        query = query.with_for_update()
    version = query.first()
    if version is None or version.asset_id != asset_id:
        raise HTTPException(status_code=404, detail='Version not found')
    if asset.asset_type != AssetType.video:
        raise HTTPException(status_code=400, detail='Rehearsal metadata requires a video asset')
    return version


def response(record):
    # Source metadata alone cannot certify the processed HLS frame mapping.
    return {'metadata_hash': record.metadata_hash, 'metadata': record.payload,
            'timing_verified': False}


@router.put('/assets/{asset_id}/versions/{version_id}/rehearsal-metadata')
def put_metadata(asset_id: uuid.UUID, version_id: uuid.UUID, body: RehearsalMetadata,
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    version = resolve(db, asset_id, version_id, user, ProjectRole.editor, lock=True)
    if version.created_by != user.id:
        raise HTTPException(status_code=403, detail='Only the uploader can attach rehearsal metadata')
    record = store(db, version_id, body.model_dump(mode='json'))
    db.commit()
    return response(record)


@router.get('/assets/{asset_id}/versions/{version_id}/rehearsal-metadata')
def get_metadata(asset_id: uuid.UUID, version_id: uuid.UUID,
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resolve(db, asset_id, version_id, user, ProjectRole.viewer)
    record = db.query(RehearsalMetadataRecord).filter(RehearsalMetadataRecord.version_id == version_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail='No rehearsal metadata for this version')
    return response(record)


@router.get('/share/{token}/assets/{asset_id}/versions/{version_id}/rehearsal-metadata')
def get_share_metadata(token: str, asset_id: uuid.UUID, version_id: uuid.UUID,
                       share_session: str | None = None,
                       db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    from ..models.asset import ProcessingStatus
    link = permissions.validate_share_link_with_session(db, token, share_session=share_session, current_user=user)
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.deleted_at.is_(None)).first()
    if asset is None:
        raise HTTPException(status_code=404, detail='Asset not found')
    permissions.validate_asset_in_share(db, link, asset)
    version = db.query(AssetVersion).filter(AssetVersion.id == version_id,
        AssetVersion.asset_id == asset_id, AssetVersion.deleted_at.is_(None),
        AssetVersion.processing_status == ProcessingStatus.ready).first()
    if version is None or version.asset_id != asset_id:
        raise HTTPException(status_code=404, detail='Version not available in this share')
    if not link.show_versions:
        latest = db.query(AssetVersion).filter(AssetVersion.asset_id == asset_id,
            AssetVersion.deleted_at.is_(None), AssetVersion.processing_status == ProcessingStatus.ready
            ).order_by(AssetVersion.version_number.desc()).first()
        if latest is None or latest.id != version_id:
            raise HTTPException(status_code=404, detail='Version not available in this share')
    record = db.query(RehearsalMetadataRecord).filter(RehearsalMetadataRecord.version_id == version_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail='No rehearsal metadata for this version')
    result = response(record)
    result['metadata'] = {k: v for k, v in record.payload.items() if k not in ('video_sha256', 'export_id')}
    return result
