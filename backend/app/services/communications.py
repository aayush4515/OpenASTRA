from datetime import datetime, timezone
from sqlalchemy import select, update
from ..models import Message, Settings, now


def enqueue(db, astronaut_id, kind, payload):
    timestamp = now()
    message = Message(
        astronaut_id=astronaut_id,
        kind=kind,
        payload=payload,
        state="QUEUED",
        history=[{"state": "CREATED", "at": timestamp}, {"state": "QUEUED", "at": timestamp}],
    )
    db.add(message)
    db.flush()
    return message


def transition(message, state, timestamp):
    message.state = state
    message.history = [*message.history, {"state": state, "at": timestamp}]


def tick(db, clock=None):
    clock = clock or datetime.now(timezone.utc)
    timestamp = clock.isoformat()
    # Serialize transport transitions against acknowledgments and settings changes.
    db.execute(update(Settings).where(Settings.id == 1).values(link_online=Settings.link_online))
    settings = db.get(Settings, 1)
    if not settings:
        return
    messages = db.scalars(
        select(Message).where(Message.state.in_(["CREATED", "QUEUED", "IN_TRANSIT"]))
    )
    for m in messages:
        if not settings.link_online:
            if m.state == "IN_TRANSIT":
                m.transit_at = None
                transition(m, "QUEUED", timestamp)
            continue
        if m.state in ("QUEUED", "CREATED"):
            m.transit_at = timestamp
            transition(m, "IN_TRANSIT", timestamp)
        if (
            m.transit_at
            and (clock - datetime.fromisoformat(m.transit_at)).total_seconds()
            >= settings.delay_seconds
        ):
            m.delivered_at = timestamp
            transition(m, "DELIVERED", timestamp)
