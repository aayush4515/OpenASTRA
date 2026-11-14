from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    Astronaut,
    Checkin,
    Reading,
    Baseline,
    FacialObservation,
    Enrollment,
    BloodTest,
    Reminder,
    Emergency,
    Settings,
    Message,
    Audit,
    Observation,
    Guidance,
)
from ..schemas import (
    ProfileInput,
    StartCheckin,
    Advance,
    EnrollmentInput,
    ResetInput,
    IngestReadings,
)
from ..services.checkins import advance
from ..services.facial import quality_valid
from ..services.questionnaire import questions
from ..seed import seed

router = APIRouter(prefix="/api")


def row(record):
    return {column.name: getattr(record, column.name) for column in record.__table__.columns}


def require(db, model, key):
    record = db.get(model, key)
    if record is None:
        raise HTTPException(404, f"{model.__name__} not found")
    return record


def ground_role(x_astra_role: str = Header(default="astronaut")):
    if x_astra_role != "mission_control":
        raise HTTPException(403, "Select the Mission Control demo role to access ground operations")


def reminder_data(reminder):
    if not reminder:
        return None
    return {
        **row(reminder),
        "status": "overdue"
        if datetime.fromisoformat(reminder.due_at) < datetime.now(timezone.utc)
        else "scheduled",
    }


@router.get("/health")
def health():
    return {"status": "ready", "database": "sqlite", "mode": "local_demo", "schema_version": 1}


@router.get("/astronauts")
def crew(db: Session = Depends(get_db)):
    result = []
    for a in db.scalars(select(Astronaut).order_by(Astronaut.id)):
        latest = db.scalar(
            select(Checkin)
            .where(Checkin.astronaut_id == a.id, Checkin.state.in_(["COMPLETED", "RESULTS_READY"]))
            .order_by(Checkin.timestamp.desc())
            .limit(1)
        )
        result.append(
            {
                **row(a),
                "latest_checkin": latest.timestamp if latest else None,
                "observations": latest.result.get("observations", []) if latest else [],
                "reminder": reminder_data(db.get(Reminder, a.id)),
                "enrolled": db.get(Enrollment, a.id) is not None,
            }
        )
    return result


@router.post("/astronauts", status_code=201)
def create_profile(data: ProfileInput, db: Session = Depends(get_db)):
    a = Astronaut(**data.model_dump())
    db.add(a)
    db.flush()
    db.add(Reminder(astronaut_id=a.id, due_at=datetime.now(timezone.utc).isoformat()))
    return row(a)


@router.patch("/astronauts/{aid}")
def update_profile(aid: str, data: ProfileInput, db: Session = Depends(get_db)):
    a = require(db, Astronaut, aid)
    for k, v in data.model_dump().items():
        setattr(a, k, v)
    r = db.get(Reminder, aid)
    if r and r.last_completed:
        r.due_at = (
            datetime.fromisoformat(r.last_completed) + timedelta(days=a.lab_interval_days)
        ).isoformat()
    return row(a)


@router.delete("/astronauts/{aid}", status_code=204)
def delete_profile(aid: str, confirmation: str, db: Session = Depends(get_db)):
    a = require(db, Astronaut, aid)
    if confirmation != a.name:
        raise HTTPException(422, "Confirm by entering the exact crew member name")
    checkin_ids = list(db.scalars(select(Checkin.id).where(Checkin.astronaut_id == aid)))
    # Audit entries contain IDs only; remove associated entries as part of local deletion.
    db.execute(delete(Audit).where(Audit.entity_id.in_([aid, *checkin_ids])))
    db.delete(a)


@router.get("/astronauts/{aid}")
def dashboard(aid: str, db: Session = Depends(get_db)):
    a = require(db, Astronaut, aid)
    checkins = list(
        db.scalars(
            select(Checkin)
            .where(Checkin.astronaut_id == aid, Checkin.state.in_(["COMPLETED", "RESULTS_READY"]))
            .order_by(Checkin.timestamp.desc())
            .limit(60)
        )
    )
    readings = list(
        db.scalars(
            select(Reading)
            .where(Reading.astronaut_id == aid)
            .order_by(Reading.timestamp.desc())
            .limit(5000)
        )
    )
    readings.reverse()
    return {
        **row(a),
        "checkins": [row(c) for c in checkins],
        "readings": [row(r) for r in readings],
        "baselines": [
            row(b) for b in db.scalars(select(Baseline).where(Baseline.astronaut_id == aid))
        ],
        "facial": [
            row(f)
            for f in db.scalars(
                select(FacialObservation)
                .where(FacialObservation.astronaut_id == aid)
                .order_by(FacialObservation.timestamp.desc())
                .limit(30)
            )
        ],
        "blood_tests": [
            row(b)
            for b in db.scalars(
                select(BloodTest)
                .where(BloodTest.astronaut_id == aid)
                .order_by(BloodTest.timestamp.desc())
            )
        ],
        "reminder": reminder_data(db.get(Reminder, aid)),
        "enrolled": db.get(Enrollment, aid) is not None,
    }


@router.post("/enrollment", status_code=201)
def enroll(data: EnrollmentInput, db: Session = Depends(get_db)):
    require(db, Astronaut, data.astronaut_id)
    if data.facial.source != "live_camera" or not quality_valid(data.facial.quality):
        raise HTTPException(422, "Enrollment requires a valid live capture and explicit consent")
    if not db.get(Enrollment, data.astronaut_id):
        db.add(Enrollment(astronaut_id=data.astronaut_id))
    db.add(
        FacialObservation(
            astronaut_id=data.astronaut_id,
            features=data.facial.features,
            quality=data.facial.quality,
            source="live_camera",
            valid=True,
        )
    )
    return {
        "status": "reference_saved",
        "identity_method": "manual_confirmation",
        "raw_images_stored": False,
    }


@router.delete("/enrollment/{aid}", status_code=204)
def delete_enrollment(aid: str, db: Session = Depends(get_db)):
    require(db, Astronaut, aid)
    db.execute(delete(Enrollment).where(Enrollment.astronaut_id == aid))
    db.execute(delete(FacialObservation).where(FacialObservation.astronaut_id == aid))
    # Remove derived facial data from saved assessments and queued payloads as well.
    for c in db.scalars(select(Checkin).where(Checkin.astronaut_id == aid)):
        c.result = {
            **c.result,
            "facial": None,
            "observations": [
                o for o in c.result.get("observations", []) if o.get("category") != "facial"
            ],
        }
        for observation in db.scalars(select(Observation).where(Observation.checkin_id == c.id)):
            if observation.details.get("category") == "facial":
                db.delete(observation)
        for guidance in db.scalars(select(Guidance).where(Guidance.checkin_id == c.id)):
            if guidance.details.get("category") == "facial":
                db.delete(guidance)
        c.draft = {k: v for k, v in c.draft.items() if not k.startswith("facial")}
    for m in db.scalars(select(Message).where(Message.astronaut_id == aid)):
        if "assessment" in m.payload:
            assessment = m.payload["assessment"]
            m.payload = {
                **m.payload,
                "assessment": {
                    **assessment,
                    "facial": None,
                    "observations": [
                        o
                        for o in assessment.get("observations", [])
                        if o.get("category") != "facial"
                    ],
                },
            }


@router.post("/checkins", status_code=201)
def start(data: StartCheckin, db: Session = Depends(get_db)):
    require(db, Astronaut, data.astronaut_id)
    c = Checkin(**data.model_dump())
    db.add(c)
    db.flush()
    return row(c)


@router.get("/checkins/{cid}")
def checkin(cid: str, db: Session = Depends(get_db)):
    return row(require(db, Checkin, cid))


@router.post("/checkins/{cid}/advance")
def next_state(cid: str, data: Advance, db: Session = Depends(get_db)):
    # A conditional update acquires SQLite's writer lock before reading mutable workflow state.
    from sqlalchemy import update

    db.execute(update(Checkin).where(Checkin.id == cid).values(state=Checkin.state))
    return row(advance(db, require(db, Checkin, cid), data))


@router.post("/checkins/{cid}/cancel")
def cancel(cid: str, db: Session = Depends(get_db)):
    from sqlalchemy import update

    db.execute(update(Checkin).where(Checkin.id == cid).values(state=Checkin.state))
    c = require(db, Checkin, cid)
    if c.state in ("COMPLETED", "RESULTS_READY"):
        raise HTTPException(409, "Saved check-ins cannot be cancelled")
    c.state, c.draft = "CANCELLED", {}
    return row(c)


@router.get("/questionnaires/{cid}")
def questionnaire(cid: str, symptoms: str = "none", db: Session = Depends(get_db)):
    c = require(db, Checkin, cid)
    from ..services.analysis import baseline_map

    return questions(c.draft.get("readings", []), symptoms, baseline_map(db, c.astronaut_id))


@router.get("/health-analysis/{aid}")
def health_analysis(aid: str, db: Session = Depends(get_db)):
    require(db, Astronaut, aid)
    c = db.scalar(
        select(Checkin)
        .where(Checkin.astronaut_id == aid, Checkin.state.in_(["COMPLETED", "RESULTS_READY"]))
        .order_by(Checkin.timestamp.desc())
        .limit(1)
    )
    return c.result if c else {"observations": [], "metrics": [], "missing_baselines": ["all"]}


@router.post("/demo/reset")
def reset(data: ResetInput, db: Session = Depends(get_db), role=Depends(ground_role)):
    # Only synthetic crew are deleted; user-created profiles and associated data survive.
    db.execute(delete(Astronaut).where(Astronaut.synthetic.is_(True)))
    existing = list(db.scalars(select(Astronaut)))
    from ..seed import CREW

    # Seed's initial emptiness check is bypassed via a dedicated option below.
    seed(db, force_demo=True)
    return {"status": "reset", "preserved_profiles": len(existing)}


@router.get("/sensors")
def sensors():
    from ..services.sensors import DEVICES

    return {
        "devices": [
            {"id": name, "metrics": metrics, "mode": "simulated"}
            for name, metrics in DEVICES.items()
        ],
        "physical_devices_connected": False,
    }


@router.post("/checkins/{cid}/readings")
def ingest(cid: str, data: IngestReadings, db: Session = Depends(get_db)):
    from sqlalchemy import update
    from ..services.sensors import validate_reading

    db.execute(update(Checkin).where(Checkin.id == cid).values(state=Checkin.state))
    c = require(db, Checkin, cid)
    if c.state != "SENSOR_COLLECTION":
        raise HTTPException(409, "Sensor ingestion is only available during collection")
    if any(r.astronaut_id != c.astronaut_id for r in data.readings):
        raise HTTPException(422, "All readings must belong to the selected astronaut")
    if len({r.metric for r in data.readings}) != len(data.readings):
        raise HTTPException(422, "Duplicate metric in collection")
    try:
        readings = [validate_reading(r).model_dump(mode="json") for r in data.readings]
    except ValueError as e:
        raise HTTPException(422, str(e))
    c.draft = {**c.draft, "readings": readings}
    c.state = "VOC_SCAN"
    return row(c)
