from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Float, Boolean, ForeignKey, JSON, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc).isoformat()


class Astronaut(Base):
    __tablename__ = "astronauts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str]
    role: Mapped[str]
    mission: Mapped[str] = mapped_column(default="Ares Pathfinder")
    color: Mapped[str] = mapped_column(default="#59dbcb")
    created_at: Mapped[str] = mapped_column(default=now)
    synthetic: Mapped[bool] = mapped_column(default=False)
    lab_interval_days: Mapped[int] = mapped_column(default=7)


class Checkin(Base):
    __tablename__ = "checkins"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), index=True
    )
    timestamp: Mapped[str] = mapped_column(default=now, index=True)
    state: Mapped[str] = mapped_column(default="IDENTIFYING")
    scenario: Mapped[str] = mapped_column(default="normal")
    draft: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict] = mapped_column(JSON, default=dict)


class Reading(Base):
    __tablename__ = "sensor_readings"
    __table_args__ = (UniqueConstraint("checkin_id", "metric"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), index=True
    )
    checkin_id: Mapped[str] = mapped_column(
        ForeignKey("checkins.id", ondelete="CASCADE"), index=True
    )
    metric: Mapped[str] = mapped_column(index=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str]
    timestamp: Mapped[str] = mapped_column(index=True)
    source: Mapped[str]
    quality: Mapped[str] = mapped_column(default="good")
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    context: Mapped[str] = mapped_column(default="resting")
    domain: Mapped[str] = mapped_column(default="body")


class Baseline(Base):
    __tablename__ = "personal_baselines"
    __table_args__ = (UniqueConstraint("astronaut_id", "metric", "source"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), index=True
    )
    metric: Mapped[str]
    median: Mapped[float]
    scale: Mapped[float]
    count: Mapped[int]
    source: Mapped[str] = mapped_column(default="synthetic_reference")
    context: Mapped[str] = mapped_column(default="resting")
    established_at: Mapped[str] = mapped_column(default=now)


class FacialObservation(Base):
    __tablename__ = "facial_observations"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), index=True
    )
    checkin_id: Mapped[str | None] = mapped_column(
        ForeignKey("checkins.id", ondelete="CASCADE"), nullable=True
    )
    timestamp: Mapped[str] = mapped_column(default=now)
    features: Mapped[dict] = mapped_column(JSON)
    quality: Mapped[dict] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(default="live_camera")
    valid: Mapped[bool] = mapped_column(default=True)


class Enrollment(Base):
    __tablename__ = "facial_enrollments"
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), primary_key=True
    )
    consent_at: Mapped[str] = mapped_column(default=now)
    method: Mapped[str] = mapped_column(default="manual_confirmation_landmark_reference")


class Response(Base):
    __tablename__ = "questionnaire_responses"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    checkin_id: Mapped[str] = mapped_column(
        ForeignKey("checkins.id", ondelete="CASCADE"), index=True, unique=True
    )
    timestamp: Mapped[str] = mapped_column(default=now)
    answers: Mapped[dict] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(default="user_reported")


class VocMeasurement(Base):
    __tablename__ = "voc_measurements"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), index=True
    )
    checkin_id: Mapped[str] = mapped_column(
        ForeignKey("checkins.id", ondelete="CASCADE"), unique=True
    )
    timestamp: Mapped[str] = mapped_column(default=now)
    channels: Mapped[list] = mapped_column(JSON)
    conditions: Mapped[dict] = mapped_column(JSON)
    simulated: Mapped[bool] = mapped_column(default=True)


class BloodTest(Base):
    __tablename__ = "blood_tests"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), index=True
    )
    timestamp: Mapped[str] = mapped_column(default=now)
    state: Mapped[str] = mapped_column(default="PREPARED")
    results: Mapped[list] = mapped_column(JSON, default=list)
    simulated: Mapped[bool] = mapped_column(default=True)


class Reminder(Base):
    __tablename__ = "reminders"
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), primary_key=True
    )
    due_at: Mapped[str]
    last_completed: Mapped[str | None] = mapped_column(nullable=True)


class Observation(Base):
    __tablename__ = "health_observations"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    checkin_id: Mapped[str] = mapped_column(
        ForeignKey("checkins.id", ondelete="CASCADE"), index=True
    )
    details: Mapped[dict] = mapped_column(JSON)


class Guidance(Base):
    __tablename__ = "guidance_records"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    checkin_id: Mapped[str] = mapped_column(
        ForeignKey("checkins.id", ondelete="CASCADE"), index=True
    )
    details: Mapped[dict] = mapped_column(JSON)


class Emergency(Base):
    __tablename__ = "emergency_events"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), index=True
    )
    timestamp: Mapped[str] = mapped_column(default=now)
    event: Mapped[str]
    crew_notified: Mapped[bool] = mapped_column(default=True)
    resolved: Mapped[bool] = mapped_column(default=False)
    protocol: Mapped[list] = mapped_column(JSON)


class Message(Base):
    __tablename__ = "communication_messages"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)
    state: Mapped[str] = mapped_column(default="CREATED", index=True)
    transit_at: Mapped[str | None] = mapped_column(nullable=True)
    delivered_at: Mapped[str | None] = mapped_column(nullable=True)
    acknowledged_at: Mapped[str | None] = mapped_column(nullable=True)
    payload: Mapped[dict] = mapped_column(JSON)
    history: Mapped[list] = mapped_column(JSON, default=list)


class Settings(Base):
    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    link_online: Mapped[bool] = mapped_column(default=True)
    delay_seconds: Mapped[int] = mapped_column(default=10)
    schema_version: Mapped[int] = mapped_column(default=1)


class Audit(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    timestamp: Mapped[str] = mapped_column(default=now)
    action: Mapped[str]
    entity_id: Mapped[str]
