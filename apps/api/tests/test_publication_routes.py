import uuid
from unittest.mock import MagicMock
from fastapi import HTTPException
from apps.api.tests.test_publication_allocation import request


def test_replay_rechecks_current_project_permission(client, auth_headers, mock_db, monkeypatch):
    from apps.api.routers import publications
    mock_db.first.return_value=MagicMock()
    def deny(*args): raise HTTPException(status_code=403,detail='Insufficient role')
    monkeypatch.setattr(publications,'require_project_role',deny)
    monkeypatch.setattr(publications,'allocate',lambda *args: (_ for _ in ()).throw(AssertionError('must not allocate')))
    assert client.post('/integrations/reapershow/publications',headers=auth_headers,json=request().model_dump(mode='json')).status_code==403


def test_deleted_version_replay_is_gone(client, auth_headers, mock_db, monkeypatch):
    from apps.api.routers import publications
    mock_db.join.return_value=mock_db
    mock_db.first.side_effect=[MagicMock(),None]
    monkeypatch.setattr(publications,'require_project_role',lambda *args:None)
    monkeypatch.setattr(publications,'allocate',lambda *args:{'version_id':str(uuid.uuid4())})
    assert client.post('/integrations/reapershow/publications',headers=auth_headers,json=request().model_dump(mode='json')).status_code==410
    mock_db.commit.assert_not_called()


import pytest

@pytest.mark.parametrize('kind', ['image', 'audio'])
def test_non_video_target_is_rejected_before_allocation(client, auth_headers, mock_db, monkeypatch, kind):
    from apps.api.routers import publications
    from apps.api.models.asset import AssetType
    target = MagicMock(asset_type=AssetType(kind))
    mock_db.first.side_effect = [MagicMock(), None, target]
    monkeypatch.setattr(publications, 'require_project_role', lambda *args: None)
    allocated = []
    def unexpected(*args):
        allocated.append(True)
        raise HTTPException(status_code=500, detail='allocation must not run')
    from apps.api.services import publications as service
    monkeypatch.setattr(service, 'allocate_upload', unexpected)
    body = request().model_dump(mode='json'); body['asset_id'] = str(uuid.uuid4())
    response = client.post('/integrations/reapershow/publications', headers=auth_headers, json=body)
    assert response.status_code == 422
    assert not allocated


def test_explicit_target_replay_keeps_deleted_version_gone_semantics(client, auth_headers, mock_db, monkeypatch):
    from types import SimpleNamespace
    from apps.api.routers import publications
    from apps.api.services import publications as service
    from apps.api.models.asset import Asset, AssetVersion
    from apps.api.models.project import Project
    from apps.api.models.publication import PublicationAllocation
    body = request().model_copy(update={'asset_id':uuid.uuid4()})
    version_id = uuid.uuid4()
    receipt = {'version_id':str(version_id)}
    row = SimpleNamespace(request_hash=service.digest(body.model_dump(mode='json')), version_id=version_id, receipt=receipt)
    def query(value):
        q=MagicMock();q.filter.return_value=q;q.join.return_value=q;q.first.return_value=value;return q
    queries={Project:query(MagicMock()),Asset:query(None),PublicationAllocation:query(row),AssetVersion:query(None)}
    mock_db.query.side_effect=lambda model:queries[model]
    monkeypatch.setattr(publications,'require_project_role',lambda *args:None)
    response=client.post('/integrations/reapershow/publications',headers=auth_headers,json=body.model_dump(mode='json'))
    assert response.status_code==410
