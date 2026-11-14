"""Reproducible, explicitly synthetic 28-day histories for three fictional crew members."""

from datetime import datetime, timedelta, timezone
from math import sin
from sqlalchemy import select
from .models import (
    Astronaut,
    Checkin,
    Reading,
    Baseline,
    VocMeasurement,
    BloodTest,
    Reminder,
    Settings,
    FacialObservation,
)
from .services.sensors import DEFAULTS, METRICS, DEVICES, voc_channels
from .services.analysis import baseline_stats, assess

CREW = [
    ("AST-001", "Maya Chen", "Mission commander", "#5bdec7", 0),
    ("AST-002", "Rafael Okafor", "Flight engineer", "#80a9ff", 7),
    ("AST-003", "Elena Voss", "Mission scientist", "#c4a2ef", -5),
]


def seed(db, force_demo=False):
    settings = db.get(Settings, 1)
    initialized = settings is not None
    if settings and settings.schema_version != 1:
        raise RuntimeError(
            "Unsupported ASTRA schema version; use a compatible release or migrate the database"
        )
    if not settings:
        db.add(Settings(id=1))
    if not force_demo and (initialized or db.scalar(select(Astronaut.id).limit(1))):
        db.flush()
        return
    today = datetime.now(timezone.utc).replace(hour=8, minute=0, second=0, microsecond=0)
    for index, (aid, name, role, color, offset) in enumerate(CREW):
        db.add(Astronaut(id=aid, name=name, role=role, color=color, synthetic=True))
        db.flush()
        reference = {
            **DEFAULTS,
            "heart_rate": DEFAULTS["heart_rate"] + offset,
            "body_mass": DEFAULTS["body_mass"] + offset,
            "sleep_hours": DEFAULTS["sleep_hours"] + index * 0.2,
        }
        histories = {metric: [] for metric in METRICS}
        latest = None
        latest_readings = []
        for day in range(28):
            timestamp = (today - timedelta(days=28 - day)).isoformat()
            c = Checkin(
                astronaut_id=aid, timestamp=timestamp, state="COMPLETED", scenario="seed", draft={}
            )
            db.add(c)
            db.flush()
            readings = []
            for n, (metric, (unit, low, high, floor, domain)) in enumerate(METRICS.items()):
                value = reference[metric] + sin(day * 0.85 + n + index) * floor
                if index == 1 and day >= 23:
                    if metric == "heart_rate":
                        value += (day - 22) * 2.3
                    if metric == "sleep_hours":
                        value -= (day - 22) * 0.35
                value = round(min(high, max(low, value)), 2)
                if day < 21:
                    histories[metric].append(value)
                device = next(d for d, metrics in DEVICES.items() if metric in metrics)
                r = dict(
                    astronaut_id=aid,
                    metric=metric,
                    value=value,
                    unit=unit,
                    timestamp=timestamp,
                    source=f"simulated_{device}",
                    simulated=True,
                    quality="good",
                    context="resting",
                    domain=domain,
                )
                db.add(Reading(checkin_id=c.id, **r))
                readings.append(r)
            db.add(
                VocMeasurement(
                    astronaut_id=aid,
                    checkin_id=c.id,
                    timestamp=timestamp,
                    channels=voc_channels(index, day=day),
                    conditions={"synthetic": True, "ambient_c": 22, "humidity_percent": 42},
                )
            )
            latest, latest_readings = c, readings
            if day % 7 == 0:
                db.add(
                    BloodTest(
                        astronaut_id=aid,
                        timestamp=timestamp,
                        state="COMPLETED",
                        results=[
                            {
                                "metric": "hemoglobin",
                                "value": round(14.2 + index * 0.5 + sin(day) * 0.2, 1),
                                "unit": "g/dL",
                                "source": "simulated_analyzer",
                                "simulated": True,
                            },
                            {
                                "metric": "glucose",
                                "value": 89 + index * 3 + day % 3,
                                "unit": "mg/dL",
                                "source": "simulated_analyzer",
                                "simulated": True,
                            },
                            {
                                "metric": "white_cell_count",
                                "value": 5.6 + index * 0.4,
                                "unit": "10^9/L",
                                "source": "simulated_analyzer",
                                "simulated": True,
                            },
                        ],
                    )
                )
        for metric, values in histories.items():
            median, scale = baseline_stats(values, METRICS[metric][3])
            db.add(
                Baseline(
                    astronaut_id=aid, metric=metric, median=median, scale=scale, count=len(values)
                )
            )
        db.add(
            Reminder(
                astronaut_id=aid,
                due_at=(today + timedelta(days=index - 1)).isoformat(),
                last_completed=(today - timedelta(days=8 - index)).isoformat(),
            )
        )
        # Fixtures are isolated from live camera history.
        for n in range(4):
            db.add(
                FacialObservation(
                    astronaut_id=aid,
                    timestamp=(today - timedelta(days=5 - n)).isoformat(),
                    features={
                        "left_eye": 0.29,
                        "right_eye": 0.3,
                        "mouth_tilt": 0.01,
                        "brow_height": 0.17,
                        "asymmetry": 0.02,
                    },
                    quality={
                        "brightness": 120,
                        "yaw": 0,
                        "roll": 0,
                        "face_size": 0.4,
                        "stability": 0.005,
                        "frames": 10,
                    },
                    source="synthetic_fixture",
                    valid=True,
                )
            )
        db.flush()
        latest.result = assess(
            db,
            aid,
            latest_readings,
            {"fatigue": "unusual" if index == 1 else "none"},
            voc_channels(index),
        )
    db.flush()
