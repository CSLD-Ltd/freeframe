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
