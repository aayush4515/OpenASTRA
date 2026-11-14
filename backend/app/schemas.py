from typing import Literal
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class ProfileInput(Strict):
    name: str = Field(min_length=2, max_length=80)
    role: str = Field(min_length=2, max_length=80)
    mission: str = Field(default="Ares Pathfinder", min_length=2, max_length=80)
    lab_interval_days: int = Field(default=7, ge=1, le=90)


Scenario = Literal["normal", "gradual", "voc_anomaly", "sensor_fault", "facial_change"]


class StartCheckin(Strict):
    astronaut_id: str
    scenario: Scenario = "normal"


class FacialInput(Strict):
    features: dict[str, float]
    quality: dict[str, float]
    source: Literal["live_camera", "synthetic_fixture"] = "live_camera"
    consent: bool

    @model_validator(mode="after")
    def validate_features(self):
        required = {"left_eye", "right_eye", "mouth_tilt", "brow_height", "asymmetry"}
        if set(self.features) != required or any(abs(v) > 3 for v in self.features.values()):
            raise ValueError("Expected five normalized landmark features")
        if set(self.quality) != {"brightness", "yaw", "roll", "face_size", "stability", "frames"}:
            raise ValueError("Incomplete capture quality")
        if not self.consent:
            raise ValueError("Explicit local feature-storage consent is required")
        return self


class Answers(Strict):
    wellbeing: int = Field(ge=1, le=10)
    fatigue: Literal["none", "mild", "unusual"]
    sleep_quality: Literal["restful", "interrupted", "poor"]
    mood: Literal["steady", "low", "anxious"]
    symptoms: Literal["none", "dizziness", "pain", "other"]
    notes: str = Field(default="", max_length=2000)
    followup: str = Field(default="", max_length=2000)


class Advance(Strict):
    expected_state: str
    identity_confirmed: bool = False
    facial: FacialInput | None = None
    answers: Answers | None = None
    overrides: dict[str, float] = Field(default_factory=dict)
    skip: bool = False


class EnrollmentInput(Strict):
    astronaut_id: str
    facial: FacialInput


class ReadingInput(Strict):
    astronaut_id: str
    metric: str
    value: float
    unit: str
    timestamp: datetime
    source: str = Field(min_length=1, max_length=80)
    quality: Literal["good", "poor", "unavailable"] = "good"
    simulated: bool
    context: Literal["resting", "post_exercise"] = "resting"
    domain: Literal["body", "environment"] = "body"


class LinkInput(Strict):
    link_online: bool
    delay_seconds: int = Field(ge=0, le=3600)


class EmergencyInput(Strict):
    astronaut_id: str
    event: Literal[
        "Chest pain and collapse", "Severe breathing difficulty", "Injury", "Other urgent concern"
    ]


class LabAdvance(Strict):
    expected_state: Literal["PREPARED", "SAMPLE_LOADED", "ANALYZING"]


class ResetInput(Strict):
    confirmation: Literal["RESET SYNTHETIC DEMO"]


class IngestReadings(Strict):
    readings: list[ReadingInput] = Field(min_length=1, max_length=100)
