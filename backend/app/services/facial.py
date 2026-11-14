import numpy as np
from sqlalchemy import select
from ..models import FacialObservation

FEATURES = ["left_eye", "right_eye", "mouth_tilt", "brow_height", "asymmetry"]


def quality_valid(q):
    return (
        50 <= q["brightness"] <= 220
        and abs(q["yaw"]) <= 0.13
        and abs(q["roll"]) <= 0.12
        and 0.22 <= q["face_size"] <= 0.72
        and q["stability"] <= 0.045
        and q["frames"] >= 8
    )


def compare(db, astronaut_id, capture):
    if not quality_valid(capture.quality):
        return {
            "status": "inadequate",
            "message": "Capture quality is inadequate. Face forward, use even lighting and repeat. No historical comparison was made.",
            "changes": [],
        }
    # Never use synthetic history to assess live video. Only previous valid captures from the same source.
    rows = list(
        db.scalars(
            select(FacialObservation)
            .where(
                FacialObservation.astronaut_id == astronaut_id,
                FacialObservation.valid.is_(True),
                FacialObservation.source == capture.source,
            )
            .order_by(FacialObservation.timestamp)
            .limit(3)
        )
    )
    if len(rows) < 3:
        return {
            "status": "building_reference",
            "message": f"{len(rows)} prior valid captures. At least 3 are needed; no change conclusion is available.",
            "changes": [],
        }
    changes = []
    for key in FEATURES:
        values = np.array([r.features[key] for r in rows])
        median = float(np.median(values))
        scale = max(float(np.median(abs(values - median))) * 1.4826, 0.015)
        z = abs(capture.features[key] - median) / scale
        changes.append(
            {
                "metric": key,
                "value": capture.features[key],
                "baseline": round(median, 4),
                "score": round(z, 2),
                "flagged": z >= 3,
            }
        )
    return {
        "status": "review" if any(c["flagged"] for c in changes) else "consistent",
        "message": "Landmark geometry only. Expression, pose and lighting can change these values. Repeat unusual measurements under consistent conditions.",
        "changes": changes,
    }
