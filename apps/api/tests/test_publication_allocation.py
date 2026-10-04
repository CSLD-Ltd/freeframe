"""A lost allocation response must not allocate another asset/version on retry."""
import uuid
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException


def request():
    module=import_module('apps.api.schemas.publication')
    return module.PublicationRequest(project_id=str(uuid.uuid4()),asset_name='Song - Take 1',
        original_filename='take.mp4',mime_type='video/mp4',file_size_bytes=1024,
        producer_id=str(uuid.uuid4()),recording_id='recording-1',take_id='take-1',export_id='export-1',export_sha256='a'*64)


def test_allocation_replays_existing_receipt_without_creating_an_upload(monkeypatch):
    service=import_module('apps.api.services.publications')
    body=request();db=MagicMock();user=SimpleNamespace(id=uuid.uuid4())
    db.query.return_value.filter.return_value.first.return_value=None
    result=SimpleNamespace(model_dump=lambda **kw:{'asset_id':str(uuid.uuid4()),'version_id':str(uuid.uuid4()),'upload_id':'upload-1','s3_key':'raw/test','chunk_size_bytes':10485760})
    monkeypatch.setattr(service,'allocate_upload',lambda *args:result)
    first=service.allocate(db,user,body)
    db.query.return_value.filter.return_value.first.return_value=db.add.call_args.args[0]
    monkeypatch.setattr(service,'allocate_upload',lambda *args:pytest.fail('Duplicate allocation'))
    second=service.allocate(db,user,body)
    assert second==first


def test_changed_export_with_same_identity_conflicts(monkeypatch):
    service=import_module('apps.api.services.publications')
    body=request();db=MagicMock();user=SimpleNamespace(id=uuid.uuid4())
    db.query.return_value.filter.return_value.first.return_value=None
    monkeypatch.setattr(service,'allocate_upload',lambda *args:SimpleNamespace(model_dump=lambda **kw:{'version_id':str(uuid.uuid4())}))
    service.allocate(db,user,body)
    db.query.return_value.filter.return_value.first.return_value=db.add.call_args.args[0]
    changed=body.model_copy(update={'export_sha256':'b'*64})
    with pytest.raises(HTTPException) as exc: service.allocate(db,user,changed)
    assert exc.value.status_code==409


def test_filename_rejects_local_paths():
    from pydantic import ValidationError
    for filename in ('/Users/chris/take.mp4', r'C:\rehearsals\take.mp4'):
        with pytest.raises(ValidationError):
            request().model_copy().model_validate({**request().model_dump(), 'original_filename':filename})


def test_purged_allocation_cannot_recreate_an_upload(monkeypatch):
    service=import_module('apps.api.services.publications')
    body=request();db=MagicMock();user=SimpleNamespace(id=uuid.uuid4())
    db.query.return_value.filter.return_value.first.return_value=None
    monkeypatch.setattr(service,'allocate_upload',lambda *args:SimpleNamespace(model_dump=lambda **kw:{'version_id':str(uuid.uuid4())}))
    service.allocate(db,user,body)
    row=db.add.call_args.args[0];row.version_id=None
    db.query.return_value.filter.return_value.first.return_value=row
    with pytest.raises(HTTPException) as exc: service.allocate(db,user,body)
    assert exc.value.status_code==410


def test_concurrent_allocations_commit_one_upload(monkeypatch):
    """Two independent transactions reproduce a double-click/lost-response race."""
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from apps.api.database import SessionLocal
    from apps.api.tests.test_usable_latest_version import _seed
    from apps.api.models.asset import ProcessingStatus, Asset, AssetVersion
    from apps.api.models.publication import PublicationAllocation
    from apps.api.models.user import User
    from apps.api.tasks import cleanup_tasks
    service=import_module('apps.api.services.publications')
    first_allocating=Event();release_first=Event();calls=[]
    with SessionLocal() as db:
        owner,project,asset,versions=_seed(db,[ProcessingStatus.ready])
        owner_id,project_id=owner.id,project.id
        version_id=versions[0].id
        db.commit()
    body=request().model_copy(update={'project_id':project_id})
    def fake_allocate(*args):
        calls.append(1);first_allocating.set()
        assert release_first.wait(5)
        return SimpleNamespace(model_dump=lambda **kw:{'version_id':str(version_id)})
    monkeypatch.setattr(service,'allocate_upload',fake_allocate)
    def submit():
        with SessionLocal() as db:
            result=service.allocate(db,SimpleNamespace(id=owner_id),body)
            db.commit()
            return result
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            first=pool.submit(submit)
            assert first_allocating.wait(5)
            second=pool.submit(submit)
            release_first.set()
            assert first.result(timeout=10)==second.result(timeout=10)
        assert len(calls)==1
        with SessionLocal() as db:
            row=db.query(PublicationAllocation).filter_by(version_id=version_id).one()
            identity_hash=row.identity_hash
            monkeypatch.setattr(cleanup_tasks,'delete_object',lambda key:None)
            cleanup_tasks._purge_version(db,version_id,cleanup_tasks.PurgeCounts())
            db.commit();db.expire_all()
            assert db.query(PublicationAllocation).filter_by(identity_hash=identity_hash).one().version_id is None
            with pytest.raises(HTTPException) as exc: service.allocate(db,SimpleNamespace(id=owner_id),body)
            assert exc.value.status_code==410
    finally:
        release_first.set()
        with SessionLocal() as db:
            db.query(PublicationAllocation).filter_by(identity_hash=service.digest([str(owner_id),str(project_id),str(body.producer_id),body.recording_id,body.take_id,body.export_id])).delete()
            monkeypatch.setattr(cleanup_tasks,'delete_object',lambda key:None)
            cleanup_tasks._purge_project(db,project_id,cleanup_tasks.PurgeCounts())
            db.query(User).filter_by(id=owner_id).delete()
            db.commit()
