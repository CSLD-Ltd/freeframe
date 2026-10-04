"""Source clocks remain exact and discontinuous; local paths never enter review metadata."""
from copy import deepcopy
from importlib import import_module
import pytest
from pydantic import ValidationError


def manifest():
    return {'format':'reapershow.review','schema_version':1,'export_id':'take-1-export-1',
        'video_sha256':'a'*64,'frame_count':'200','video_rate':{'numerator':'50','denominator':'1'},
        'timecode_rate':{'numerator':'25','denominator':'1'},'drop_frame':False,
        'clock_spans':[{'id':'run-1','clip_start':'0','clip_end':'100','source_start':'90000'},
                       {'id':'run-2','clip_start':'120','clip_end':'200','source_start':'95000'}],
        'cues':[{'id':'cue-1','clip_frame':'20','clock_span_id':'run-1','sequence':'1','cue':'12.5'},
                {'id':'cue-2','clip_frame':'130','clock_span_id':'run-2','sequence':'1','cue':'12.5'}]}


def schema():
    return import_module('apps.api.schemas.rehearsal').RehearsalMetadata


def test_metadata_preserves_distinct_video_ltc_rates_and_repeated_cues():
    m=schema().model_validate(manifest())
    assert m.frame_count == '200'
    assert [c.id for c in m.cues] == ['cue-1','cue-2']
    assert m.source_frame('20') == '90010'
    assert m.source_frame('21') == '90010'
    assert m.source_frame('119') is None
    assert m.source_frame('120') == '95000'
    assert m.source_frame('200') is None


@pytest.mark.parametrize('field,value', [('frame_count','0200'),('frame_count','0'),('schema_version',2),('video_sha256','bad'),('drop_frame',True)])
def test_metadata_rejects_invalid_or_unsupported_header(field,value):
    data=manifest();data[field]=value
    with pytest.raises(ValidationError): schema().model_validate(data)


@pytest.mark.parametrize('mutation', ['overlap','out_of_range','bad_rate','cue_gap','duplicate_cue','local_path','unknown_span'])
def test_metadata_rejects_false_mapping_or_private_fields(mutation):
    data=deepcopy(manifest())
    if mutation=='overlap': data['clock_spans'][1]['clip_start']='99'
    if mutation=='out_of_range': data['clock_spans'][1]['clip_end']='201'
    if mutation=='bad_rate': data['video_rate']['denominator']='0'
    if mutation=='cue_gap': data['cues'][1]['clip_frame']='110'
    if mutation=='duplicate_cue': data['cues'][1]['id']='cue-1'
    if mutation=='local_path': data['video_path']='/Users/chris/Private/song.mov'
    if mutation=='unknown_span': data['cues'][1]['clock_span_id']='missing'
    with pytest.raises(ValidationError): schema().model_validate(data)


def test_half_ltc_frame_phase_survives_a_50fps_trim():
    data=manifest();data['clock_spans'][0]['source_phase']={'numerator':'1','denominator':'2'}
    m=schema().model_validate(data)
    assert m.source_frame('20')=='90010'
    assert m.source_frame('21')=='90011'
