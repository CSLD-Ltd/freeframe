"""Share inventories must report password protection without exposing passwords."""
from datetime import datetime, timezone
import uuid
import pytest
from apps.api.models.share import ShareLink, SharePermission
from apps.api.schemas.share import ShareLinkResponse

@pytest.mark.parametrize("password_hash,protected", [(None, False), ("private-password-hash", True)])
def test_orm_share_response_reports_actual_password_protection(password_hash, protected):
    link = ShareLink(id=uuid.uuid4(), asset_id=uuid.uuid4(), token="test-token",
                     title="Review", is_enabled=True, permission=SharePermission.comment,
                     visibility="public", allow_download=False, show_versions=False,
                     show_watermark=False, appearance={}, created_at=datetime.now(timezone.utc),
                     password_hash=password_hash)
    response = ShareLinkResponse.model_validate(link)
    assert response.has_password is protected
    assert "private-password-hash" not in response.model_dump_json()
    assert response.password_value is None
