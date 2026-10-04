import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..middleware.auth import get_current_user
from ..models.project import Project, ProjectRole
from ..models.asset import Asset, AssetVersion
from ..models.user import User
from ..services.permissions import require_project_role
from ..services.publications import allocate
from ..schemas.publication import PublicationRequest
from ..schemas.upload import InitiateUploadResponse

router = APIRouter(prefix="/integrations/reapershow", tags=["rehearsal"])


@router.post("/publications", response_model=InitiateUploadResponse)
def create_publication(body: PublicationRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == body.project_id, Project.deleted_at.is_(None)).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    # Recheck on every replay; a previous receipt does not grant access.
    require_project_role(db, body.project_id, user, ProjectRole.editor)
    receipt = allocate(db, user, body)
    version = db.query(AssetVersion).join(Asset, Asset.id == AssetVersion.asset_id).filter(
        AssetVersion.id == uuid.UUID(receipt["version_id"]), AssetVersion.deleted_at.is_(None),
        Asset.deleted_at.is_(None), Asset.project_id == body.project_id).first()
    if version is None:
        raise HTTPException(status_code=410, detail="Publication has been deleted")
    db.commit()
    return receipt
