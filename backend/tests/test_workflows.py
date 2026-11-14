from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select, func
from pydantic import ValidationError
from backend.app.models import (
    Checkin,
    Reading,
    Message,
    Response,
    FacialObservation,
    Astronaut,
    Baseline,
    Reminder,
    Settings,
    VocMeasurement,
)
from backend.app.services.analysis import baseline_stats, assess
from backend.app.services.communications import tick
from backend.app.services.sensors import validate_reading
from backend.app.schemas import ReadingInput

GROUND = {"X-Astra-Role": "mission_control"}
ANSWERS = {
    "wellbeing": 8,
    "fatigue": "none",
    "sleep_quality": "restful",
    "mood": "steady",
    "symptoms": "none",
    "notes": "",
    "followup": "",
}


def start(client, scenario="normal", aid="AST-001"):
    r = client.post("/api/checkins", json={"astronaut_id": aid, "scenario": scenario})
    assert r.status_code == 201, r.text
    return r.json()


def advance(client, c, **extra):
    r = client.post(
        f"/api/checkins/{c['id']}/advance", json={"expected_state": c["state"], **extra}
    )
    assert r.status_code == 200, r.text
    return r.json()


def complete(client, scenario="normal", aid="AST-001", facial=None, answers=None):
    c = start(client, scenario, aid)
    c = advance(client, c, identity_confirmed=True)
    c = advance(client, c)
    c = advance(client, c, **({"facial": facial} if facial else {"skip": True}))
    c = advance(client, c)
    c = advance(client, c)
    c = advance(
        client,
        c,
        answers=answers or {**ANSWERS, "followup": "Interrupted sleep due to mission activity."},
    )
    c = advance(client, c)
    return advance(client, c)


def test_seed_initialization_and_personal_baselines(client, db_factory):
    crew = client.get("/api/astronauts").json()
    assert len(crew) == 3
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(Checkin)) == 84
        a = db.scalar(
            select(Baseline).where(
                Baseline.astronaut_id == "AST-001", Baseline.metric == "heart_rate"
            )
        )
        b = db.scalar(
            select(Baseline).where(
                Baseline.astronaut_id == "AST-002", Baseline.metric == "heart_rate"
            )
        )
        assert abs(a.median - b.median) > 5 and a.count == 21
    assert client.get("/api/astronauts/unknown").status_code == 404


def test_profile_crud_and_cascade(client, db_factory):
    r = client.post("/api/astronauts", json={"name": "Test Crew", "role": "Scientist"})
    assert r.status_code == 201
    aid = r.json()["id"]
    assert (
        client.patch(
            "/api/astronauts/" + aid,
            json={"name": "Updated Crew", "role": "Commander", "lab_interval_days": 10},
        ).status_code
        == 200
    )
    complete(client, aid=aid)
    assert client.delete(f"/api/astronauts/{aid}?confirmation=wrong").status_code == 422
    assert client.delete(f"/api/astronauts/{aid}?confirmation=Updated%20Crew").status_code == 204
    with db_factory() as db:
        assert (
            db.scalar(select(func.count()).select_from(Reading).where(Reading.astronaut_id == aid))
            == 0
        )
        assert (
            db.scalar(select(func.count()).select_from(Message).where(Message.astronaut_id == aid))
            == 0
        )


def test_checkin_atomic_persistence_and_duplicate_prevention(client, db_factory):
    c = complete(client)
    assert c["state"] == "COMPLETED" and c["draft"] == {}
    assert c["result"]["facial"]["status"] == "skipped"
    with db_factory() as db:
        assert (
            db.scalar(
                select(func.count()).select_from(Reading).where(Reading.checkin_id == c["id"])
            )
            == 11
        )
        assert db.scalar(select(Response).where(Response.checkin_id == c["id"]))
        assert db.scalar(select(VocMeasurement).where(VocMeasurement.checkin_id == c["id"]))
        assert db.scalar(select(Message).where(Message.kind == "health_report"))
    r = client.post(f"/api/checkins/{c['id']}/advance", json={"expected_state": "PROCESSING"})
    assert r.status_code == 409
    assert client.post(f"/api/checkins/{c['id']}/cancel").status_code == 409


def test_cancellation_has_no_partial_results(client, db_factory):
    c = start(client)
    c = advance(client, c, identity_confirmed=True)
    c = advance(client, c)
    c = advance(client, c, skip=True)
    c = advance(client, c)
    assert c["draft"]["readings"]
    r = client.post(f"/api/checkins/{c['id']}/cancel")
    assert r.json()["draft"] == {}
    with db_factory() as db:
        assert not list(db.scalars(select(Reading).where(Reading.checkin_id == c["id"])))


def test_invalid_state_and_unknown_astronaut(client):
    assert client.post("/api/checkins", json={"astronaut_id": "missing"}).status_code == 404
    c = start(client)
    assert (
        client.post(
            f"/api/checkins/{c['id']}/advance", json={"expected_state": "PROCESSING"}
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"/api/checkins/{c['id']}/advance", json={"expected_state": "IDENTIFYING"}
        ).status_code
        == 422
    )


def test_sensor_failure_and_skip(client):
    c = start(client, "sensor_fault")
    c = advance(client, c, identity_confirmed=True)
    c = advance(client, c)
    c = advance(client, c, skip=True)
    r = client.post(f"/api/checkins/{c['id']}/advance", json={"expected_state": c["state"]})
    assert r.status_code == 503
    assert client.get(f"/api/checkins/{c['id']}").json()["state"] == "SENSOR_COLLECTION"
    c = advance(client, c, skip=True)
    c = advance(client, c)
    c = advance(client, c, answers=ANSWERS)
    c = advance(client, c)
    assert "physiological sensors" in c["result"]["missing_data"]


def test_invalid_sensor_measurement_does_not_advance(client):
    c = start(client)
    c = advance(client, c, identity_confirmed=True)
    c = advance(client, c)
    c = advance(client, c, skip=True)
    assert (
        client.post(
            f"/api/checkins/{c['id']}/advance",
            json={"expected_state": c["state"], "overrides": {"spo2": 110}},
        ).status_code
        == 422
    )
    assert client.get(f"/api/checkins/{c['id']}").json()["state"] == "SENSOR_COLLECTION"


@pytest.mark.parametrize(
    "change",
    [
        {"unit": "kg"},
        {"value": 300},
        {"domain": "environment"},
        {"source": "simulated_test", "simulated": False},
    ],
)
def test_ingestion_contract_rejects_invalid_readings(change):
    data = dict(
        astronaut_id="a",
        metric="heart_rate",
        value=70,
        unit="bpm",
        timestamp=datetime.now(timezone.utc),
        source="simulated_test",
        simulated=True,
    )
    with pytest.raises((ValueError, ValidationError)):
        validate_reading(ReadingInput(**{**data, **change}))


def test_robust_baseline_and_multimodal_anomaly(client):
    median, scale = baseline_stats([60, 61, 60, 59, 60, 200], 2)
    assert median == 60 and scale == 2
    normal = complete(client)
    changed = complete(
        client,
        "gradual",
        answers={**ANSWERS, "fatigue": "unusual", "followup": "Less sleep over the last few days."},
    )
    assert not any(o["category"] == "multimodal" for o in normal["result"]["observations"])
    assert any(o["category"] == "multimodal" for o in changed["result"]["observations"])
    assert any(m["metric"] == "heart_rate" and m["score"] > 3 for m in changed["result"]["metrics"])


def test_voc_anomaly_and_missing_baseline(client):
    c = complete(client, "voc_anomaly")
    assert c["result"]["voc"]["status"] == "review"
    assert c["result"]["voc"]["scores"][1] > 5
    aid = client.post("/api/astronauts", json={"name": "New Crew", "role": "Science"}).json()["id"]
    c = complete(client, aid=aid)
    assert "heart_rate" in c["result"]["missing_baselines"]
    assert c["result"]["voc"]["status"] == "insufficient_history"


FACE = {
    "features": {
        "left_eye": 0.15,
        "right_eye": 0.3,
        "mouth_tilt": 0.01,
        "brow_height": 0.17,
        "asymmetry": 0.02,
    },
    "quality": {
        "brightness": 120,
        "yaw": 0,
        "roll": 0,
        "face_size": 0.4,
        "stability": 0.005,
        "frames": 10,
    },
    "source": "synthetic_fixture",
    "consent": True,
}


def test_camera_fixture_is_separate_from_live_history(client):
    fixture = complete(client, "facial_change", facial=FACE)
    assert fixture["result"]["facial"]["status"] == "review"
    live = complete(client, facial={**FACE, "source": "live_camera"})
    assert live["result"]["facial"]["status"] == "building_reference"
    poor = complete(client, facial={**FACE, "quality": {**FACE["quality"], "brightness": 10}})
    assert (
        poor["result"]["facial"]["status"] == "inadequate"
        and poor["result"]["facial"]["changes"] == []
    )


def test_enrollment_consent_and_deletion(client):
    assert (
        client.post("/api/enrollment", json={"astronaut_id": "AST-001", "facial": FACE}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/enrollment",
            json={
                "astronaut_id": "AST-001",
                "facial": {**FACE, "source": "live_camera", "consent": False},
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/enrollment",
            json={"astronaut_id": "AST-001", "facial": {**FACE, "source": "live_camera"}},
        ).status_code
        == 201
    )
    assert client.get("/api/astronauts/AST-001").json()["enrolled"]
    assert client.delete("/api/enrollment/AST-001").status_code == 204
    assert client.get("/api/astronauts/AST-001").json()["facial"] == []


def test_adaptive_questionnaire(client):
    c = start(client, "gradual")
    c = advance(client, c, identity_confirmed=True)
    c = advance(client, c)
    c = advance(client, c, skip=True)
    c = advance(client, c)
    c = advance(client, c)
    q = client.get(f"/api/questionnaires/{c['id']}?symptoms=dizziness").json()
    assert len(q["followups"]) == 2
    assert (
        client.post(
            f"/api/checkins/{c['id']}/advance",
            json={
                "expected_state": "QUESTIONNAIRE",
                "answers": {**ANSWERS, "symptoms": "dizziness"},
            },
        ).status_code
        == 422
    )


def test_labs_and_reminders_survive_new_session(client, db_factory):
    aid = "AST-001"
    before = client.get("/api/astronauts/" + aid).json()["reminder"]
    assert before["status"] == "overdue"
    lab = client.post("/api/blood-tests/" + aid).json()
    assert client.post("/api/blood-tests/" + aid).json()["id"] == lab["id"]
    for state in ["PREPARED", "SAMPLE_LOADED", "ANALYZING"]:
        r = client.post(f"/api/blood-tests/{lab['id']}/advance", json={"expected_state": state})
        assert r.status_code == 200, r.text
    after = client.get("/api/astronauts/" + aid).json()["reminder"]
    assert after["status"] == "scheduled"
    assert (
        datetime.fromisoformat(after["due_at"]) - datetime.fromisoformat(after["last_completed"])
    ).days == 7
    with db_factory() as db:
        assert db.get(Reminder, aid).due_at == after["due_at"]
    assert (
        client.post(
            f"/api/blood-tests/{lab['id']}/advance", json={"expected_state": "ANALYZING"}
        ).status_code
        == 409
    )


def test_emergency_queue_outage_delivery_and_ack(client, db_factory):
    assert client.get("/api/mission-control").status_code == 403
    assert (
        client.put(
            "/api/communications/settings",
            json={"link_online": False, "delay_seconds": 3},
            headers=GROUND,
        ).status_code
        == 200
    )
    e = client.post(
        "/api/emergencies", json={"astronaut_id": "AST-001", "event": "Chest pain and collapse"}
    )
    assert e.status_code == 201
    assert e.json()["crew_notified"]
    c = complete(client)
    queue = client.get("/api/communications").json()
    assert all(m["state"] == "QUEUED" for m in queue["messages"])
    assert client.get("/api/mission-control", headers=GROUND).json()["reports"] == []
    mid = queue["messages"][0]["id"]
    assert (
        client.post("/api/communications/" + mid + "/acknowledge", headers=GROUND).status_code
        == 409
    )
    client.put(
        "/api/communications/settings",
        json={"link_online": True, "delay_seconds": 3},
        headers=GROUND,
    )
    with db_factory() as db:
        tick(db, datetime.now(timezone.utc) + timedelta(seconds=4))
        db.commit()
    assert client.get("/api/communications").json()["messages"][0]["state"] == "DELIVERED"
    assert len(client.get("/api/mission-control", headers=GROUND).json()["reports"]) == 2
    assert (
        client.post("/api/communications/" + mid + "/acknowledge", headers=GROUND).json()["state"]
        == "ACKNOWLEDGED"
    )


def test_outage_requeues_in_transit(client):
    complete(client)
    assert client.get("/api/communications").json()["messages"][0]["state"] == "IN_TRANSIT"
    client.put(
        "/api/communications/settings",
        json={"link_online": False, "delay_seconds": 10},
        headers=GROUND,
    )
    message = client.get("/api/communications").json()["messages"][0]
    assert message["state"] == "QUEUED" and message["transit_at"] is None


def test_demo_reset_preserves_user_profiles(client):
    aid = client.post("/api/astronauts", json={"name": "Keep Me", "role": "Science"}).json()["id"]
    complete(client, aid=aid)
    assert (
        client.post("/api/demo/reset", json={"confirmation": "wrong"}, headers=GROUND).status_code
        == 422
    )
    r = client.post(
        "/api/demo/reset", json={"confirmation": "RESET SYNTHETIC DEMO"}, headers=GROUND
    )
    assert r.status_code == 200, r.text
    assert len(client.get("/api/astronauts").json()) == 4
    assert len(client.get("/api/astronauts/" + aid).json()["checkins"]) == 1


def test_empty_database(client, db_factory):
    with db_factory() as db:
        for a in db.scalars(select(Astronaut)):
            db.delete(a)
        db.commit()
    assert client.get("/api/astronauts").json() == []
    assert client.get("/api/communications").json()["messages"] == []


def test_generic_ingestion_keeps_real_data_separate_from_synthetic_reference(client):
    c = start(client)
    c = advance(client, c, identity_confirmed=True)
    c = advance(client, c)
    c = advance(client, c, skip=True)
    data = {
        "astronaut_id": "AST-001",
        "metric": "heart_rate",
        "value": 76,
        "unit": "bpm",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "hardware_test_adapter",
        "simulated": False,
    }
    r = client.post(f"/api/checkins/{c['id']}/readings", json={"readings": [data]})
    assert r.status_code == 200, r.text
    c = r.json()
    c = advance(client, c)
    c = advance(client, c, answers=ANSWERS)
    c = advance(client, c)
    assert c["result"]["metrics"][0]["baseline"] is None
    assert c["result"]["metrics"][0]["simulated"] is False


def test_new_profile_builds_frozen_reference_after_eligible_history(client):
    aid = client.post(
        "/api/astronauts", json={"name": "Reference Crew", "role": "Scientist"}
    ).json()["id"]
    for _ in range(7):
        complete(client, aid=aid)
    before = client.get("/api/astronauts/" + aid).json()["baselines"]
    assert len(before) == 11
    complete(
        client,
        "gradual",
        aid=aid,
        answers={**ANSWERS, "fatigue": "unusual", "followup": "Changed rest."},
    )
    after = client.get("/api/astronauts/" + aid).json()["baselines"]
    assert before == after


def test_intentionally_empty_database_is_not_reseeded_on_restart(client, db_factory):
    from backend.app.seed import seed

    with db_factory() as db:
        for astronaut in db.scalars(select(Astronaut)):
            db.delete(astronaut)
        db.commit()
    with db_factory() as db:
        seed(db)
        db.commit()
        assert db.scalar(select(func.count()).select_from(Astronaut)) == 0


def test_checkin_and_queue_survive_engine_recreation(client, db_factory):
    from sqlalchemy.orm import sessionmaker
    from backend.app.database import make_engine

    checkin = complete(client)
    with db_factory() as db:
        url = str(db.get_bind().url)
    engine = make_engine(url)
    factory = sessionmaker(engine)
    with factory() as db:
        assert db.get(Checkin, checkin["id"]).state == "COMPLETED"
        assert (
            db.scalar(
                select(func.count()).select_from(Reading).where(Reading.checkin_id == checkin["id"])
            )
            == 11
        )
        assert db.scalar(select(Message).where(Message.astronaut_id == "AST-001")) is not None
    engine.dispose()


def test_analysis_failure_rolls_back_all_final_records(client, db_factory, monkeypatch):
    from backend.app.services import checkins

    c = start(client)
    c = advance(client, c, identity_confirmed=True)
    for payload in ({}, {"skip": True}, {}, {}, {"answers": ANSWERS}):
        c = advance(client, c, **payload)
    assert c["state"] == "PROCESSING"

    def fail_queue(*args, **kwargs):
        raise RuntimeError("Injected queue persistence failure")

    monkeypatch.setattr(checkins, "enqueue", fail_queue)
    with pytest.raises(RuntimeError, match="Injected"):
        advance(client, c)
    with db_factory() as db:
        assert db.get(Checkin, c["id"]).state == "PROCESSING"
        assert not list(db.scalars(select(Reading).where(Reading.checkin_id == c["id"])))
        assert not db.scalar(select(Response).where(Response.checkin_id == c["id"]))


def test_production_spa_and_offline_camera_assets(client):
    from backend.app.main import DIST

    if not (DIST / "index.html").exists():
        pytest.skip("Build the frontend to test the production assets")
    for route in [
        "/",
        "/booth",
        "/astronaut/AST-001",
        "/intelligence/AST-001",
        "/emergency",
        "/mission-control",
        "/settings",
    ]:
        response = client.get(route)
        assert response.status_code == 200
        assert "ASTRA" in response.text and "/assets/" in response.text
    assert client.get("/api/not-a-real-endpoint").status_code == 404
    for asset in [
        "/models/face_landmarker.task",
        "/wasm/vision_wasm_internal.wasm",
        "/wasm/vision_wasm_internal.js",
    ]:
        response = client.get(asset)
        assert response.status_code == 200
        assert len(response.content) > 1000
