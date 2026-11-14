from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Astronaut, Checkin, BloodTest, Reminder, Emergency, Message, Settings, now
from ..schemas import LabAdvance, EmergencyInput, LinkInput
from ..services.communications import enqueue, tick, transition
from .core import require, row, ground_role, crew, reminder_data

router = APIRouter(prefix="/api")
PROTOCOL = [
    "Alert the other crew members and the crew medical officer immediately using the onboard alarm or voice channel.",
    "Follow the mission-approved onboard emergency procedures and the directions of the trained crew medical officer.",
    "Assign a crew member to record the event and prepare available observations. Do not wait for Earth communications.",
    "This interface records a simulation only. It does not trigger a physical alarm or replace emergency training.",
]


@router.get("/reminders")
def reminders(db: Session = Depends(get_db)):
    return [reminder_data(r) for r in db.scalars(select(Reminder))]


@router.post("/blood-tests/{aid}", status_code=201)
def start_lab(aid: str, db: Session = Depends(get_db)):
    require(db, Astronaut, aid)
    db.execute(update(Astronaut).where(Astronaut.id == aid).values(name=Astronaut.name))
    lab = db.scalar(
        select(BloodTest).where(BloodTest.astronaut_id == aid, BloodTest.state != "COMPLETED")
    )
    if not lab:
        lab = BloodTest(astronaut_id=aid)
        db.add(lab)
        db.flush()
    return row(lab)


@router.post("/blood-tests/{bid}/advance")
def advance_lab(bid: str, data: LabAdvance, db: Session = Depends(get_db)):
    db.execute(update(BloodTest).where(BloodTest.id == bid).values(state=BloodTest.state))
    lab = require(db, BloodTest, bid)
    if data.expected_state != lab.state:
        raise HTTPException(409, "Lab state changed. Refresh and retry.")
    next_state = {
        "PREPARED": "SAMPLE_LOADED",
        "SAMPLE_LOADED": "ANALYZING",
        "ANALYZING": "COMPLETED",
    }
    lab.state = next_state[lab.state]
    if lab.state == "COMPLETED":
        a = require(db, Astronaut, lab.astronaut_id)
        # Deterministic illustrative panel. Never represents a collected biological sample.
        lab.results = [
            {
                "metric": "hemoglobin",
                "value": 14.4,
                "unit": "g/dL",
                "source": "simulated_analyzer",
                "simulated": True,
            },
            {
                "metric": "glucose",
                "value": 92,
                "unit": "mg/dL",
                "source": "simulated_analyzer",
                "simulated": True,
            },
            {
                "metric": "white_cell_count",
                "value": 5.9,
                "unit": "10^9/L",
                "source": "simulated_analyzer",
                "simulated": True,
            },
        ]
        lab.timestamp = now()
        reminder = require(db, Reminder, lab.astronaut_id)
        reminder.last_completed = lab.timestamp
        reminder.due_at = (
            datetime.fromisoformat(lab.timestamp) + timedelta(days=a.lab_interval_days)
        ).isoformat()
        enqueue(db, a.id, "lab_report", {"lab_id": lab.id, "results": lab.results})
    return row(lab)


@router.post("/emergencies", status_code=201)
def emergency(data: EmergencyInput, db: Session = Depends(get_db)):
    require(db, Astronaut, data.astronaut_id)
    e = Emergency(**data.model_dump(), protocol=PROTOCOL)
    db.add(e)
    db.flush()
    enqueue(
        db,
        e.astronaut_id,
        "emergency",
        {
            "event_id": e.id,
            "event": e.event,
            "crew_notification": "simulated",
            "protocol": PROTOCOL,
        },
    )
    return row(e)


@router.get("/emergencies")
def emergencies(db: Session = Depends(get_db)):
    return [row(e) for e in db.scalars(select(Emergency).order_by(Emergency.timestamp.desc()))]


@router.post("/emergencies/{eid}/resolve")
def resolve(eid: str, db: Session = Depends(get_db)):
    e = require(db, Emergency, eid)
    e.resolved = True
    return row(e)


@router.get("/communications")
def communications(db: Session = Depends(get_db)):
    tick(db)
    return {
        "settings": row(require(db, Settings, 1)),
        "messages": [
            row(m)
            for m in db.scalars(select(Message).order_by(Message.created_at.desc()).limit(100))
        ],
    }


@router.put("/communications/settings")
def settings(data: LinkInput, db: Session = Depends(get_db), role=Depends(ground_role)):
    s = require(db, Settings, 1)
    s.link_online, s.delay_seconds = data.link_online, data.delay_seconds
    db.flush()
    tick(db)
    return row(s)


@router.post("/communications/{mid}/acknowledge")
def acknowledge(mid: str, db: Session = Depends(get_db), role=Depends(ground_role)):
    db.execute(update(Message).where(Message.id == mid).values(state=Message.state))
    m = require(db, Message, mid)
    if m.state != "DELIVERED":
        raise HTTPException(409, "Only delivered messages can be acknowledged")
    m.acknowledged_at = now()
    transition(m, "ACKNOWLEDGED", m.acknowledged_at)
    return row(m)


@router.post("/communications/report/{aid}", status_code=201)
def report(aid: str, db: Session = Depends(get_db)):
    require(db, Astronaut, aid)
    c = db.scalar(
        select(Checkin)
        .where(Checkin.astronaut_id == aid, Checkin.state.in_(["COMPLETED", "RESULTS_READY"]))
        .order_by(Checkin.timestamp.desc())
        .limit(1)
    )
    if not c:
        raise HTTPException(409, "Complete a check-in before preparing a report")
    return row(enqueue(db, aid, "health_report", {"checkin_id": c.id, "assessment": c.result}))


@router.get("/mission-control")
def mission_control(db: Session = Depends(get_db), role=Depends(ground_role)):
    tick(db)
    # Ground content is derived ONLY from delivered messages. Unsent onboard health details stay onboard.
    delivered = list(
        db.scalars(
            select(Message)
            .where(Message.state.in_(["DELIVERED", "ACKNOWLEDGED"]))
            .order_by(Message.created_at.desc())
            .limit(100)
        )
    )
    roster = [
        dict(id=a.id, name=a.name, role=a.role, color=a.color)
        for a in db.scalars(select(Astronaut))
    ]
    return {"crew": roster, "reports": [row(m) for m in delivered]}
