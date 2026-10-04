"""Bounded, path-free source-clock metadata for verified rehearsal exports.

Clip frames and source LTC labels are separate clocks. A span asserts a verified
unit-speed mapping; missing spans are explicitly unmapped. Physical latency is
not inferred here. Drop-frame mappings are deferred in schema version 1.
"""
from fractions import Fraction
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Count = Annotated[str, Field(pattern=r'^(0|[1-9][0-9]{0,18})$')]
Identifier = Annotated[str, Field(pattern=r'^[A-Za-z0-9_.:-]{1,128}$')]
CueNumber = Annotated[str, Field(pattern=r'^[0-9]{1,12}(\.[0-9]{1,12})?$')]
MAX_COUNT = 2**63 - 1


class StrictMetadata(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Rate(StrictMetadata):
    numerator: Count
    denominator: Count

    @model_validator(mode='after')
    def bounded(self):
        n, d = int(self.numerator), int(self.denominator)
        if not 1 <= n <= 240000 or not 1 <= d <= 1001:
            raise ValueError('Unsupported rate bounds')
        if not Fraction(1) <= Fraction(n, d) <= Fraction(240):
            raise ValueError('Unsupported frame rate')
        return self

    def fraction(self) -> Fraction:
        return Fraction(int(self.numerator), int(self.denominator))


class SourcePhase(StrictMetadata):
    numerator: Count
    denominator: Count

    @model_validator(mode='after')
    def bounded(self):
        if not 0 <= int(self.numerator) < int(self.denominator) <= 1_000_000_000:
            raise ValueError('Source phase must be a bounded fraction of one LTC frame')
        return self

    def fraction(self):
        return Fraction(int(self.numerator), int(self.denominator))


class ClockSpan(StrictMetadata):
    id: Identifier
    clip_start: Count
    clip_end: Count
    source_start: Count
    source_phase: SourcePhase = Field(default_factory=lambda: SourcePhase(numerator="0", denominator="1"))


class CueOccurrence(StrictMetadata):
    id: Identifier
    clip_frame: Count
    clock_span_id: Identifier
    sequence: CueNumber
    cue: CueNumber
    # Stable console context; occurrence IDs distinguish repeated cues.
    data_pool: CueNumber | None = None
    source: Literal['recorded', 'simulated'] = 'recorded'


class RehearsalMetadata(StrictMetadata):
    format: Literal['reapershow.review']
    schema_version: Literal[1]
    export_id: Identifier
    video_sha256: Annotated[str, Field(pattern=r'^[0-9a-f]{64}$')]
    frame_count: Count
    video_rate: Rate
    timecode_rate: Rate
    drop_frame: Literal[False]
    clock_spans: list[ClockSpan] = Field(max_length=10000)
    cues: list[CueOccurrence] = Field(max_length=100000)

    @model_validator(mode='after')
    def coherent(self):
        count = int(self.frame_count)
        if not 0 < count <= MAX_COUNT:
            raise ValueError('Invalid exported frame count')
        if self.timecode_rate.fraction() not in (Fraction(24), Fraction(25), Fraction(30)):
            raise ValueError('Schema 1 requires 24, 25 or 30 non-drop timecode')
        spans = {}
        previous_end = 0
        ratio = self.timecode_rate.fraction() / self.video_rate.fraction()
        for span in self.clock_spans:
            start, end, source = int(span.clip_start), int(span.clip_end), int(span.source_start)
            if span.id in spans or not previous_end <= start < end <= count:
                raise ValueError('Clock spans overlap, are unordered or exceed export')
            if source + span.source_phase.fraction() + (end - start) * ratio > MAX_COUNT:
                raise ValueError('Source clock exceeds integer bounds')
            spans[span.id] = span
            previous_end = end
        seen = set()
        previous_frame = -1
        for cue in self.cues:
            frame = int(cue.clip_frame)
            span = spans.get(cue.clock_span_id)
            if cue.id in seen or frame < previous_frame or span is None:
                raise ValueError('Cue occurrence identity, order or clock span is invalid')
            if not int(span.clip_start) <= frame < int(span.clip_end):
                raise ValueError('Cue occurrence is outside verified mapping')
            seen.add(cue.id)
            previous_frame = frame
        return self

    def source_frame(self, clip_frame: str) -> str | None:
        """Containing LTC label, not invented sub-frame detected precision."""
        if not clip_frame.isascii() or not clip_frame.isdigit():
            return None
        frame = int(clip_frame)
        for span in self.clock_spans:
            if int(span.clip_start) <= frame < int(span.clip_end):
                offset = span.source_phase.fraction() + (frame - int(span.clip_start)) * self.timecode_rate.fraction() / self.video_rate.fraction()
                return str(int(span.source_start) + offset.numerator // offset.denominator)
        return None
