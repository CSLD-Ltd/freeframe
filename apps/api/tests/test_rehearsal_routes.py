import uuid
from types import SimpleNamespace
from unittest.mock import patch
import pytest
from apps.api.tests.test_rehearsal_metadata import manifest


@pytest.mark.parametrize('is_owner,want', [(True,200),(False,403)])
def test_metadata_write_requires_upload_owner(client,auth_headers,mock_db,test_user,is_owner,want):
    asset=SimpleNamespace(id=uuid.uuid4(),project_id=uuid.uuid4(),asset_type='video')
    version=SimpleNamespace(id=uuid.uuid4(),asset_id=asset.id,created_by=test_user.id if is_owner else uuid.uuid4())
    mock_db.join.return_value=mock_db
    mock_db.with_for_update.return_value=mock_db
    mock_db.first.side_effect=[asset,version,None]
    with patch('apps.api.services.permissions.require_project_role'):
        response=client.put(f'/assets/{asset.id}/versions/{version.id}/rehearsal-metadata',headers=auth_headers,json=manifest())
    assert response.status_code==want,response.text
    if is_owner:
        assert response.json()['timing_verified'] is False
        assert len(response.json()['metadata_hash'])==64


def test_metadata_rejects_version_from_another_asset(client,auth_headers,mock_db,test_user):
    asset=SimpleNamespace(id=uuid.uuid4(),project_id=uuid.uuid4(),asset_type='video')
    version=SimpleNamespace(id=uuid.uuid4(),asset_id=uuid.uuid4(),created_by=test_user.id)
    mock_db.join.return_value=mock_db
    mock_db.with_for_update.return_value=mock_db
    mock_db.first.side_effect=[asset,version]
    with patch('apps.api.services.permissions.require_project_role'):
        response=client.put(f'/assets/{asset.id}/versions/{version.id}/rehearsal-metadata',headers=auth_headers,json=manifest())
    assert response.status_code==404


def test_guest_metadata_hides_unshared_version(client,mock_db):
    from apps.api.models.asset import ProcessingStatus
    aid,vid=uuid.uuid4(),uuid.uuid4()
    mock_db.first.side_effect=[SimpleNamespace(id=aid),SimpleNamespace(id=vid,asset_id=aid),SimpleNamespace(id=uuid.uuid4())]
    with patch('apps.api.services.permissions.validate_share_link_with_session',return_value=SimpleNamespace(show_versions=False)),patch('apps.api.services.permissions.validate_asset_in_share'):
        response=client.get(f'/share/token/assets/{aid}/versions/{vid}/rehearsal-metadata')
    assert response.status_code==404


def test_guest_projection_excludes_export_hash_and_identity(client,mock_db):
    aid,vid=uuid.uuid4(),uuid.uuid4()
    mock_db.first.side_effect=[SimpleNamespace(id=aid),SimpleNamespace(id=vid,asset_id=aid),SimpleNamespace(metadata_hash='a'*64,payload=manifest())]
    with patch('apps.api.services.permissions.validate_share_link_with_session',return_value=SimpleNamespace(show_versions=True)),patch('apps.api.services.permissions.validate_asset_in_share'):
        response=client.get(f'/share/token/assets/{aid}/versions/{vid}/rehearsal-metadata')
    assert response.status_code==200,response.text
    assert 'video_sha256' not in response.json()['metadata']
    assert 'export_id' not in response.json()['metadata']
    assert len(response.json()['metadata']['cues'])==2


def test_guest_metadata_enforces_password_session(client,mock_db):
    from fastapi import HTTPException
    with patch('apps.api.services.permissions.validate_share_link_with_session',side_effect=HTTPException(status_code=403,detail='Password required')):
        response=client.get(f'/share/token/assets/{uuid.uuid4()}/versions/{uuid.uuid4()}/rehearsal-metadata')
    assert response.status_code==403
    mock_db.query.assert_not_called()
