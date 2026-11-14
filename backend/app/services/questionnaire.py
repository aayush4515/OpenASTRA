"""Predefined branching questions; no generated medical advice."""


def questions(readings, symptoms="none", baseline=None):
    reference = (baseline or {}).get("sleep_hours")
    low_sleep = any(
        r["metric"] == "sleep_hours"
        and r["value"] < (reference - 1 if reference is not None else 6)
        for r in readings
    )
    followups = []
    if low_sleep:
        followups.append(
            "Sleep was shorter in this simulation. Describe interruptions and how rested you feel."
        )
    if symptoms == "dizziness":
        followups.append(
            "When did the dizziness begin? Was it related to position or activity? Describe any accompanying symptoms to the crew medical officer."
        )
    if symptoms == "pain":
        followups.append(
            "Where is the discomfort, when did it start, and has it changed? For an urgent concern, use Emergency now."
        )
    if symptoms == "other":
        followups.append("Describe the new symptom and when it began.")
    return {
        "followups": followups,
        "voice": "Typed and selectable responses work offline. Local speech recognition is not installed.",
    }
