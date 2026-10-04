"""Immutable per-version metadata: repeated input is safe, replacement conflicts."""
import uuid
from unittest.mock import MagicMock
from importlib import import_module
import pytest
from fastapi import HTTPException
from apps.api.tests.test_rehearsal_metadata import manifest


def service():
    return import_module('apps.api.services.rehearsal_metadata')


def test_rehearsal_store_replays_same_payload_without_replacing_it():
    db=MagicMock();version_id=uuid.uuid4()
    db.query.return_value.filter.return_value.first.return_value=None
    first=service().store(db,version_id,manifest())
    db.query.return_value.filter.return_value.first.return_value=first
    second=service().store(db,version_id,manifest())
    assert second is first
    assert db.add.call_count == 1


def test_rehearsal_store_refuses_changed_payload():
    db=MagicMock();version_id=uuid.uuid4()
    db.query.return_value.filter.return_value.first.return_value=None
    first=service().store(db,version_id,manifest())
    db.query.return_value.filter.return_value.first.return_value=first
    changed=manifest();changed['video_sha256']='b'*64
    with pytest.raises(HTTPException) as exc: service().store(db,version_id,changed)
    assert exc.value.status_code == 409


def test_rehearsal_metadata_is_persisted_and_purged_with_its_version(real_db,monkeypatch):
    from apps.api.tests.test_usable_latest_version import _seed
    from apps.api.models.asset import ProcessingStatus
    from apps.api.models.rehearsal import RehearsalMetadataRecord
    from apps.api.tasks import cleanup_tasks
    _,_,_,versions=_seed(real_db,[ProcessingStatus.ready])
    row=service().store(real_db,versions[0].id,manifest())
    real_db.expire_all()
    persisted=real_db.query(RehearsalMetadataRecord).filter_by(version_id=versions[0].id).one()
    assert persisted.metadata_hash==row.metadata_hash
    assert persisted.payload['frame_count']=='200'
    monkeypatch.setattr(cleanup_tasks,'delete_object',lambda key:None)
    cleanup_tasks._purge_version(real_db,versions[0].id,cleanup_tasks.PurgeCounts())
    assert real_db.query(RehearsalMetadataRecord).filter_by(version_id=versions[0].id).count()==0
