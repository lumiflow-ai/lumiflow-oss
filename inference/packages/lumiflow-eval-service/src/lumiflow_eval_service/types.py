from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Union, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, RootModel, field_serializer, model_serializer, Field


# Our data schema convention is to use `ID` rather than `Id` e.g. `eventSummaryID`
def to_camel(string: str) -> str:
    components = string.split("_")
    result = components[0] + "".join(word.capitalize() for word in components[1:])
    if result.endswith("Id"):
        result = result[:-2] + "ID"
    return result


class ISO8601PreciseTimestamp(BaseModel):
    timestamp: datetime

    @model_serializer
    def serialize_timestamp(self) -> str:
        return self.timestamp.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class ArtifactPathComponent(BaseModel):
    id: Union[UUID, str]
    kind: Optional[str] = None


class ArtifactPath(RootModel[List[ArtifactPathComponent]]):
    def __len__(self) -> int:
        return len(self.root)

    def __add__(self, other: Union[ArtifactPathComponent, List[ArtifactPathComponent]]) -> "ArtifactPath":
        if isinstance(other, ArtifactPathComponent):
            path_components = self.root + [other]
            return ArtifactPath(root=path_components)
        elif isinstance(other, list):  # Use 'list' instead of 'List[ArtifactPathComponent]'
            path_components = self.root + other
            return ArtifactPath(root=path_components)
        else:
            raise TypeError("Operand must be an ArtifactPathComponent or list")

    def model_dump(self, *args, **kwargs):
        # Return only the list of components (root list)
        return self.root


class MetricExample(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    artifact_path: ArtifactPath
    matching_content: Optional[str] = None

    @property
    def sorting_key(self):
        # Create a tuple with artifactPath sorted by id and kind, followed by matchingContent
        artifact_path_tuple = [
            (component.id, component.kind or "")  # Default kind to empty string if None
            for component in self.artifact_path.root
        ]
        return (artifact_path_tuple, self.matching_content or "")


class MetricRecording(BaseModel, alias_generator=to_camel, populate_by_name=True):
    event_summary_id: UUID
    generation_id: str
    value: Union[bool, int, float]
    examples: Optional[List[MetricExample]] = None

    @field_serializer("event_summary_id")
    def serialize_event_summary_id(self, id: UUID) -> str:
        return str(id)


class Metric(BaseModel, alias_generator=to_camel, populate_by_name=True):
    id: UUID
    values: List[MetricRecording]
    is_mock: bool = True

    @field_serializer("id")
    def serialize_id(self, id: UUID) -> str:
        return str(id)

    @property
    def sorting_key(self):
        return str(id)


class ArtifactSelector(BaseModel):
    artifact_path: ArtifactPath
    event_summary_ids: List[UUID]
    generation_ids: List[str]


PrimitiveValue = Union[bool, str, int, float, None]


class RenderedContent(RootModel):
    root: Union[PrimitiveValue, Dict[str, "RenderedContent"]]

    @model_serializer
    def serialize_root(self) -> Union[PrimitiveValue, Dict[str, "RenderedContent"]]:
        if isinstance(self.root, dict):
            return {k: v.model_dump(exclude_none=True, exclude_unset=True) for k, v in self.root.items()}
        return self.root


RenderedContent.model_rebuild()


class ArtifactMetricGeneration(BaseModel, alias_generator=to_camel, populate_by_name=True):
    event_summary_id: UUID
    generation_id: str
    model_id: str
    end_timestamp: ISO8601PreciseTimestamp
    did_complete: bool

    @field_serializer("event_summary_id")
    def serialize_event_summary_id(self, id: UUID) -> str:
        return str(id)


class ArtifactSnapshot(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    artifact_path: ArtifactPath
    event_summary_id: UUID
    timestamp: ISO8601PreciseTimestamp
    content: RenderedContent = RenderedContent(root="")
    source_artifact_selectors: List[ArtifactSelector] = []
    tags: Dict[str, str] = {}
    metadata: Dict[str, str] = {}
    metrics: List[Metric] = []
    generations: List[ArtifactMetricGeneration]

    @field_serializer("event_summary_id")
    def serialize_event_summary_id(self, id: UUID) -> str:
        return str(id)


class Artifact(BaseModel, alias_generator=to_camel, populate_by_name=True):
    artifact_path: ArtifactPath
    source_artifact_paths: Optional[ArtifactPath] = None
    snapshots: List[ArtifactSnapshot]
    metrics: Optional[Metric] = None


class Snapshot(BaseModel, alias_generator=to_camel, populate_by_name=True):
    event_summary_id: UUID
    timestamp: datetime
    content: Optional[str] = None

    @field_serializer("timestamp")
    def serialize_timestamp(self, dt: datetime) -> str:
        # Format to ISO 8601 with trailing Z (UTC)
        return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

    @field_serializer("event_summary_id")
    def serialize_event_summary_id(self, id: UUID) -> str:
        return str(id)


class MetricKind(Enum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    UNKNOWN = "unknown"


class MetricDefinition(BaseModel, alias_generator=to_camel, populate_by_name=True):
    id: UUID
    name: str
    precursor_id: Optional[UUID] = None
    is_deleted: Optional[bool] = None
    order: Optional[str] = None
    group: Optional[str] = None
    kind: Optional[MetricKind]
    unit: Optional[str] = None
    color: Optional[str] = None

    @field_serializer("id")
    def serialize_id(self, id: UUID) -> str:
        return str(id)


class Session(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    id: str = Field(min_length=1)
    transcript: str = Field(min_length=1)
    report: str = Field(min_length=1)
    parameters: Optional[Dict[str, str]]
    timestamp: datetime
    event_summary_id: UUID
    generation_id: str = Field(min_length=1)
    org_id: UUID


class GenerationStats(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    total_tokens_sent: int
    total_tokens_generated: int
    cost: float
    errors: List[str]
    org_id: UUID
    event_summary_id: UUID
    generation_id: str
    model_id: str
    model_params: Optional[Dict[str, Any]] = None
    total_wall_duration: float
    cluster_id: str

    def model_dump(self, **kwargs) -> Dict[str, Any]:
        # Always exclude None values for this model
        kwargs.setdefault("exclude_none", True)
        return super().model_dump(**kwargs)


class EvaluationOut(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    artifacts: List[Any]
    generation: GenerationStats


class RecipeCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    question: str = Field(min_length=1, examples=["Are any medications mentioned?"])
    parameters: Optional[Dict[str, str]] = Field(default=None, examples=[{"model": "llama-3-1-70b"}])


class RecipeCreateOut(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    class PromptOut(BaseModel):
        model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

        template: str = Field(examples=["Does the artifact mention any medications? Artifact: {input}"])
        input_name: str = Field(examples=["input"])

    class ModelOut(BaseModel):
        model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

        name: str = Field(examples=["llama-3-1-70b"])
        temperature: Optional[float] = Field(examples=[0.9], default=None)
        top_p: Optional[float] = Field(examples=[0.5], default=None)
        max_new_tokens: Optional[int] = Field(examples=[2048], default=None)

    class MetricOut(BaseModel):
        model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, use_enum_values=True)

        name: str = Field(examples=["Medication mentioned"])
        kind: MetricKind = Field(examples=[MetricKind.BOOLEAN.value])
        # unit: Optional[str] = Field(examples=["detected", "found"])

    prompt: PromptOut = Field()
    model: ModelOut = Field()
    metric: MetricOut = Field()


class RecipeEvaluate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    class Prompt(BaseModel):
        model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

        template: str = Field(examples=["Does the artifact mention any medications? Artifact: {input}"])
        input_name: str = Field(examples=["input"])
        input_value: str = Field(examples=["The patient is taking aspirin and ibuprofen."])

    class Model(BaseModel):
        model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

        name: str = Field(examples=["llama-3-1-70b"])
        temperature: Optional[float] = Field(examples=[0.9], default=None)
        top_p: Optional[float] = Field(examples=[0.5], default=None)
        max_new_tokens: Optional[int] = Field(examples=[2048], default=None)

    prompt: Prompt = Field()
    model: Model = Field()
    timestamp: datetime
    event_summary_id: UUID
    generation_id: str = Field(min_length=1)
    org_id: UUID


class RecipeEvaluateOut(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    value: bool = Field(examples=[True])
    evidence: List[str] = Field(examples=["The report mentions aspirin and ibuprofen."])
    generation: GenerationStats


class RetryableEvalFailure(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    retryable: bool = True
    code: str
    message: str
    retry_after_seconds: float
    lane: str
