"""Explainable robust deviations. Statistical flags are never emergency diagnoses."""

import numpy as np
from sqlalchemy import select
from ..models import Baseline, Reading, VocMeasurement, BloodTest
from .sensors import METRICS

GUIDANCE = {
    "routine": "Continue the planned onboard monitoring schedule.",
    "repeat": "Repeat the measurement under the same resting conditions. Ask the crew medical officer to review persistent changes.",
    "sleep": "Discuss fatigue and sleep interruptions with the crew medical officer and review the onboard rest schedule.",
    "voc": "Repeat with consistent collection conditions. Cabin air, hygiene products and sensor variation can affect this experimental fingerprint.",
    "lab": "Ask the crew medical officer to review the simulated lab change with other observations. This is not an actual blood analysis.",
}


def baseline_stats(values, floor=0.1):
    a = np.asarray(values, dtype=float)
    median = float(np.median(a))
    return median, max(float(np.median(np.abs(a - median))) * 1.4826, floor)


def baseline_map(db, astronaut_id):
    return {
        b.metric: b.median
        for b in db.scalars(
            select(Baseline).where(
                Baseline.astronaut_id == astronaut_id, Baseline.source == "synthetic_reference"
            )
        )
    }


def assess(db, astronaut_id, readings, answers, voc, facial=None):
    baselines = {
        b.metric: b
        for b in db.scalars(
            select(Baseline).where(
                Baseline.astronaut_id == astronaut_id, Baseline.source == "synthetic_reference"
            )
        )
    }
    metrics, observations = [], []
    for r in readings:
        b = baselines.get(r["metric"])
        if r["quality"] != "good" or r["context"] != "resting":
            continue
        history = list(
            db.scalars(
                select(Reading)
                .where(
                    Reading.astronaut_id == astronaut_id,
                    Reading.metric == r["metric"],
                    Reading.quality == "good",
                    Reading.context == r["context"],
                    Reading.simulated == r["simulated"],
                )
                .order_by(Reading.timestamp.desc())
                .limit(7)
            )
        )
        trend = (
            float(np.polyfit(range(len(history)), [h.value for h in reversed(history)], 1)[0])
            if len(history) > 1
            else 0
        )
        # Reference provenance must match; never compare future real hardware to synthetic baselines.
        comparable = b is not None and b.count >= 5 and r["simulated"]
        score = abs(r["value"] - b.median) / b.scale if comparable else None
        m = {
            "metric": r["metric"],
            "value": r["value"],
            "unit": r["unit"],
            "baseline": b.median if comparable else None,
            "score": round(score, 2) if score is not None else None,
            "delta": round(r["value"] - b.median, 2) if comparable else None,
            "trend": round(trend, 3),
            "count": b.count if comparable else 0,
            "domain": r["domain"],
            "source": r["source"],
            "simulated": r["simulated"],
        }
        metrics.append(m)
        if score is not None and score >= 3:
            observations.append(
                {
                    "category": "measurement",
                    "level": "review",
                    "title": r["metric"].replace("_", " ").capitalize() + " differs from reference",
                    "evidence": f"{r['value']} {r['unit']} versus personal median {b.median:.2f} across {b.count} reference readings; robust deviation {score:.1f}.",
                    "next_step": GUIDANCE["repeat"],
                    "provenance": r["source"],
                    "metrics": [r["metric"]],
                }
            )
    by_metric = {m["metric"]: m for m in metrics}
    hr, sleep = by_metric.get("heart_rate"), by_metric.get("sleep_hours")
    if (
        hr
        and sleep
        and hr["delta"] is not None
        and sleep["delta"] is not None
        and hr["delta"] > 6
        and sleep["delta"] < -1
        and answers.get("fatigue") == "unusual"
    ):
        observations.insert(
            0,
            {
                "category": "multimodal",
                "level": "review",
                "title": "Rest and recovery pattern changed",
                "evidence": "Higher resting pulse, shorter sleep and self-reported unusual fatigue occur together. This is a pattern for review, not a diagnosis.",
                "next_step": GUIDANCE["sleep"],
                "provenance": "simulated sensors + user report",
                "metrics": ["heart_rate", "sleep_hours", "fatigue"],
            },
        )
    if (
        answers.get("symptoms", "none") != "none"
        or answers.get("wellbeing", 10) <= 4
        or answers.get("mood") in ("low", "anxious")
    ):
        observations.append(
            {
                "category": "subjective",
                "level": "review",
                "title": "Your check-in needs a conversation",
                "evidence": "Your reported symptoms, mood or well-being warrant follow-up; these responses do not identify a condition.",
                "next_step": "Share the reported changes with the crew medical officer. Use Emergency immediately for an urgent concern.",
                "provenance": "user_reported",
                "metrics": ["wellbeing", "symptoms", "mood"],
            }
        )
    voc_result = {"status": "missing", "channels": [], "baseline": [], "scores": []}
    if voc:
        history = list(
            db.scalars(
                select(VocMeasurement)
                .where(VocMeasurement.astronaut_id == astronaut_id)
                .order_by(VocMeasurement.timestamp)
                .limit(21)
            )
        )
        if len(history) >= 5:
            matrix = np.array([v.channels for v in history])
            center = np.median(matrix, axis=0)
            scale = np.maximum(np.median(abs(matrix - center), axis=0) * 1.4826, 2)
            scores = abs(np.array(voc) - center) / scale
            voc_result = {
                "status": "review" if max(scores) >= 3 else "consistent",
                "channels": voc,
                "baseline": center.tolist(),
                "scores": np.round(scores, 2).tolist(),
            }
            if max(scores) >= 3:
                observations.append(
                    {
                        "category": "experimental",
                        "level": "repeat",
                        "title": "VOC fingerprint changed",
                        "evidence": f"{int(sum(scores >= 3))} of 6 synthetic channels differ from the personal reference. No molecule or hormone concentration is inferred.",
                        "next_step": GUIDANCE["voc"],
                        "provenance": "simulated_e_nose / experimental",
                        "metrics": ["voc"],
                    }
                )
        else:
            voc_result = {
                "status": "insufficient_history",
                "channels": voc,
                "baseline": [],
                "scores": [],
            }
    if facial and facial["status"] == "review":
        observations.append(
            {
                "category": "facial",
                "level": "repeat",
                "title": "Facial geometry needs confirmation",
                "evidence": facial["message"],
                "next_step": "Repeat in even lighting, neutral expression and matching camera position. Seek crew review for persistent concerns.",
                "provenance": facial.get("source", "live_camera"),
                "metrics": ["facial"],
            }
        )
    labs = list(
        db.scalars(
            select(BloodTest)
            .where(BloodTest.astronaut_id == astronaut_id, BloodTest.state == "COMPLETED")
            .order_by(BloodTest.timestamp.desc())
            .limit(2)
        )
    )
    if len(labs) == 2:
        previous = {r["metric"]: r["value"] for r in labs[1].results}
        for r in labs[0].results:
            if (
                r["metric"] in previous
                and abs(r["value"] - previous[r["metric"]]) / max(previous[r["metric"]], 0.01) > 0.1
            ):
                observations.append(
                    {
                        "category": "lab",
                        "level": "review",
                        "title": "Simulated laboratory change",
                        "evidence": f"{r['metric']}: {r['value']} {r['unit']} versus previous {previous[r['metric']]}; exceeds the illustrative 10% change rule.",
                        "next_step": GUIDANCE["lab"],
                        "provenance": "simulated_analyzer",
                        "metrics": [r["metric"]],
                    }
                )
    if not observations:
        observations.append(
            {
                "category": "routine",
                "level": "routine",
                "title": "No deviations flagged in available data",
                "evidence": "Available comparable measurements did not exceed the illustrative statistical rules. Missing data is not evidence of health.",
                "next_step": GUIDANCE["routine"],
                "provenance": "computed",
                "metrics": [],
            }
        )
    return {
        "metrics": metrics,
        "observations": observations,
        "voc": voc_result,
        "facial": facial,
        "baseline_policy": "Frozen personal synthetic reference; median and 1.4826 × MAD with a measurement-specific floor. Flag at ≥3. This is a demo rule, not a NASA medical threshold.",
        "missing_baselines": [m["metric"] for m in metrics if m["baseline"] is None],
        "limitations": "Technology demonstrator. Statistical flags and simulated data do not establish a diagnosis or rule out emergencies.",
    }


def establish_reference(db, astronaut_id):
    """Freeze a reference after seven eligible simulated check-ins; never absorb flagged scenarios."""
    from ..models import Checkin, Response

    if db.scalar(select(Baseline.id).where(Baseline.astronaut_id == astronaut_id).limit(1)):
        return
    candidates = list(
        db.scalars(
            select(Checkin)
            .where(
                Checkin.astronaut_id == astronaut_id,
                Checkin.scenario == "normal",
                Checkin.state.in_(["RESULTS_READY", "COMPLETED"]),
            )
            .order_by(Checkin.timestamp)
        )
    )
    eligible = []
    for c in candidates:
        response = db.scalar(select(Response).where(Response.checkin_id == c.id))
        answers = response.answers if response else {}
        if (
            answers.get("fatigue") == "none"
            and answers.get("symptoms") == "none"
            and answers.get("wellbeing", 0) >= 6
        ):
            eligible.append(c.id)
    if len(eligible) < 7:
        return
    for metric, definition in METRICS.items():
        values = list(
            db.scalars(
                select(Reading.value).where(
                    Reading.checkin_id.in_(eligible[:7]),
                    Reading.metric == metric,
                    Reading.simulated.is_(True),
                    Reading.context == "resting",
                    Reading.quality == "good",
                )
            )
        )
        if len(values) < 7:
            continue
        median, scale = baseline_stats(values, definition[3])
        # Exclude isolated outliers before accepting an initial reference.
        clean = [v for v in values if abs(v - median) <= 3 * scale]
        if len(clean) < 5:
            continue
        median, scale = baseline_stats(clean, definition[3])
        db.add(
            Baseline(
                astronaut_id=astronaut_id,
                metric=metric,
                median=median,
                scale=scale,
                count=len(clean),
                source="synthetic_reference",
            )
        )
