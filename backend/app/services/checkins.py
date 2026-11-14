from fastapi import HTTPException
from sqlalchemy import select
from ..models import (
    Checkin,
    Reading,
    Response,
    VocMeasurement,
    FacialObservation,
    Observation,
    Guidance,
    Audit,
)
from .sensors import collect_all, voc_channels
from .analysis import assess, baseline_map, establish_reference
from .facial import compare, quality_valid
from .questionnaire import questions
from .communications import enqueue

TRANSITIONS = {
    "IDENTIFYING": "IDENTITY_CONFIRMED",
    "IDENTITY_CONFIRMED": "FACIAL_SCAN",
    "FACIAL_SCAN": "SENSOR_COLLECTION",
    "SENSOR_COLLECTION": "VOC_SCAN",
    "VOC_SCAN": "QUESTIONNAIRE",
    "QUESTIONNAIRE": "PROCESSING",
    "PROCESSING": "RESULTS_READY",
    "RESULTS_READY": "COMPLETED",
}


def advance(db, c, request):
    if c.state != request.expected_state:
        raise HTTPException(
            409, f"Expected {request.expected_state}, actual {c.state}. Refresh before retrying."
        )
    if c.state not in TRANSITIONS:
        raise HTTPException(409, "This check-in cannot advance")
    draft = dict(c.draft)
    if c.state == "IDENTIFYING":
        if not request.identity_confirmed:
            raise HTTPException(422, "Confirm the selected identity manually")
        draft["identity_method"] = "manual_confirmation"
    elif c.state == "FACIAL_SCAN":
        if request.facial:
            comparison = compare(db, c.astronaut_id, request.facial)
            draft["facial"] = request.facial.model_dump()
            draft["facial_comparison"] = {**comparison, "source": request.facial.source}
        elif not request.skip:
            raise HTTPException(422, "Capture facial features or explicitly skip camera")
        else:
            draft["facial_comparison"] = {
                "status": "skipped",
                "message": "Camera assessment was skipped; no facial conclusion is available.",
                "changes": [],
            }
    elif c.state == "SENSOR_COLLECTION":
        if request.skip:
            draft["readings"] = []
        else:
            try:
                draft["readings"] = collect_all(
                    c.astronaut_id, baseline_map(db, c.astronaut_id), c.scenario, request.overrides
                )
            except TimeoutError as e:
                raise HTTPException(503, str(e))
            except ValueError as e:
                raise HTTPException(422, str(e))
    elif c.state == "VOC_SCAN":
        # Per-profile deterministic seed, stable across process restarts.
        index = int(c.astronaut_id[-1]) - 1 if c.astronaut_id.startswith("AST-00") else 0
        draft["voc"] = voc_channels(index, c.scenario)
    elif c.state == "QUESTIONNAIRE":
        if not request.answers:
            raise HTTPException(422, "Questionnaire responses are required")
        q = questions(
            draft.get("readings", []), request.answers.symptoms, baseline_map(db, c.astronaut_id)
        )
        if q["followups"] and not request.answers.followup:
            raise HTTPException(422, "Please answer the follow-up question")
        draft["answers"] = request.answers.model_dump()
    elif c.state == "PROCESSING":
        # Analysis is calculated against prior records; all final records commit in one transaction.
        result = assess(
            db,
            c.astronaut_id,
            draft.get("readings", []),
            draft["answers"],
            draft.get("voc"),
            draft.get("facial_comparison"),
        )
        for reading in draft.get("readings", []):
            db.add(Reading(checkin_id=c.id, **reading))
        db.add(Response(checkin_id=c.id, answers=draft["answers"]))
        db.add(
            VocMeasurement(
                astronaut_id=c.astronaut_id,
                checkin_id=c.id,
                channels=draft["voc"],
                conditions={
                    "ambient_c": 22,
                    "humidity_percent": 42,
                    "collection": "synthetic skin VOC channels",
                    "unit": "relative response",
                },
            )
        )
        if draft.get("facial"):
            f = draft["facial"]
            db.add(
                FacialObservation(
                    astronaut_id=c.astronaut_id,
                    checkin_id=c.id,
                    features=f["features"],
                    quality=f["quality"],
                    source=f["source"],
                    valid=quality_valid(f["quality"]),
                )
            )
        for observation in result["observations"]:
            db.add(Observation(checkin_id=c.id, details=observation))
            db.add(
                Guidance(
                    checkin_id=c.id,
                    details={
                        "category": observation["category"],
                        "text": observation["next_step"],
                        "reviewed": False,
                    },
                )
            )
        result["missing_data"] = ["physiological sensors"] if not draft.get("readings") else []
        c.result = result
        enqueue(db, c.astronaut_id, "health_report", {"checkin_id": c.id, "assessment": result})
        db.add(Audit(action="checkin.saved", entity_id=c.id))
        draft = {}  # Do not duplicate sensitive responses after finalization.
    c.draft = draft
    c.state = TRANSITIONS[c.state]
    db.flush()
    if c.state == "RESULTS_READY":
        establish_reference(db, c.astronaut_id)
    return c
