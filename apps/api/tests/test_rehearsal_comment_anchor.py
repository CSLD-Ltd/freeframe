import uuid
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from apps.api.tests.test_rehearsal_metadata import manifest


def anchor(frame='20',cue='cue-1'):
    from apps.api.schemas.comment import CommentCreate
    return CommentCreate(version_id=uuid.uuid4(),body='Reduce this look',clip_frame=frame,
                         cue_occurrence_id=cue,rehearsal_metadata_hash='a'*64)


def stored():
    from apps.api.schemas.rehearsal import RehearsalMetadata
    m=RehearsalMetadata.model_validate(manifest())
    return type('Record',(),{'metadata_hash':'a'*64,'payload':m.model_dump(mode='json')})()


def test_cue_anchor_round_trip_uses_exact_occurrence():
    from apps.api.services.rehearsal_comments import validate_anchor
    row=stored();cue=row.payload['cues'][0]
    db=MagicMock();db.query.return_value.filter.return_value.first.return_value=row
    fields=validate_anchor(db,anchor(cue['clip_frame'],cue['id']))
    assert fields['clip_frame']==int(cue['clip_frame'])
    assert fields['cue_occurrence_id']==cue['id']
    assert fields['rehearsal_metadata_hash']=='a'*64


@pytest.mark.parametrize('change',[{'clip_frame':'200'},{'rehearsal_metadata_hash':'b'*64},
    {'cue_occurrence_id':'other-take'}, {'clip_frame':'21'}])
def test_anchor_rejects_wrong_version_or_out_of_range(change):
    from apps.api.services.rehearsal_comments import validate_anchor
    db=MagicMock();db.query.return_value.filter.return_value.first.return_value=stored()
    with pytest.raises(HTTPException): validate_anchor(db,anchor().model_copy(update=change))


def test_legacy_comment_does_not_query_metadata():
    from apps.api.services.rehearsal_comments import validate_anchor
    from apps.api.schemas.comment import CommentCreate
    db=MagicMock()
    assert validate_anchor(db,CommentCreate(version_id=uuid.uuid4(),body='General note'))=={}
    db.query.assert_not_called()


def test_comment_anchor_persists_as_integer_and_serializes_as_decimal(real_db):
    from apps.api.tests.test_usable_latest_version import _seed
    from apps.api.models.asset import ProcessingStatus
    from apps.api.models.comment import Comment
    from apps.api.schemas.comment import CommentResponse
    from apps.api.services.rehearsal_metadata import store
    from apps.api.services.rehearsal_comments import validate_anchor
    owner,_,asset,versions=_seed(real_db,[ProcessingStatus.ready])
    record=store(real_db,versions[0].id,manifest())
    request=anchor().model_copy(update={'version_id':versions[0].id,'rehearsal_metadata_hash':record.metadata_hash})
    fields=validate_anchor(real_db,request)
    comment=Comment(asset_id=asset.id,version_id=versions[0].id,author_id=owner.id,body=request.body,**fields)
    real_db.add(comment);real_db.flush();real_db.expire_all()
    persisted=real_db.query(Comment).filter_by(id=comment.id).one()
    assert persisted.clip_frame==20
    response=CommentResponse.model_validate(persisted).model_dump(mode='json')
    assert response['clip_frame']=='20'
    assert response['cue_occurrence_id']=='cue-1'
    assert response['timecode_start']==0.4
