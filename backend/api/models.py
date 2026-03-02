from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    data_types: List[str]


class DatasetVersionCreate(BaseModel):
    target_output: Dict[str, Any] = Field(default_factory=dict)


class DataSourceCreate(BaseModel):
    source_type: str
    source_uri: str
    options: Dict[str, Any] = Field(default_factory=dict)


class AssetCreate(BaseModel):
    uri: str
    media_type: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LabelCreate(BaseModel):
    label_type: str
    payload: Dict[str, Any]
    annotator: str
    confidence: Optional[float] = None


class JobCreate(BaseModel):
    type: str = "PIPELINE_RUN"
