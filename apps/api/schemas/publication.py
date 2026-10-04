"""Path-free identity for an explicitly requested rehearsal publication."""
import uuid
from typing import Annotated, Literal
from pydantic import ConfigDict, Field, field_validator
from .upload import InitiateUploadRequest

Identifier = Annotated[str, Field(pattern=r"^[A-Za-z0-9_.:-]{1,128}$")]


class PublicationRequest(InitiateUploadRequest):
    model_config = ConfigDict(extra="forbid")
    asset_name: str = Field(min_length=1, max_length=255)
    original_filename: str = Field(min_length=1, max_length=255)
    mime_type: Literal["video/mp4"]
    producer_id: uuid.UUID
    recording_id: Identifier
    take_id: Identifier
    export_id: Identifier
    export_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")

    @field_validator("original_filename")
    @classmethod
    def basename_only(cls, value):
        if "/" in value or "\\" in value or any(ord(c) < 32 for c in value) or value in (".", ".."):
            raise ValueError("Only a filename may be transmitted")
        return value
