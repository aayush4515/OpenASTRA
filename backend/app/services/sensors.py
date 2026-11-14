"""Deterministic devices implement the same validated ingestion contract as future hardware."""

from abc import ABC, abstractmethod
from math import sin
from ..schemas import ReadingInput
from ..models import now

# Validation limits describe accepted input, not medical decision thresholds.
METRICS = {
    "heart_rate": ("bpm", 25, 240, 2.0, "body"),
    "systolic": ("mmHg", 50, 260, 3.0, "body"),
    "diastolic": ("mmHg", 30, 180, 2.0, "body"),
    "spo2": ("%", 50, 100, 0.7, "body"),
    "temperature": ("°C", 30, 43, 0.12, "body"),
    "body_mass": ("kg", 20, 250, 0.4, "body"),
    "sleep_hours": ("h", 0, 24, 0.3, "body"),
    "sleep_quality": ("%", 0, 100, 4.0, "body"),
    "activity": ("min", 0, 1440, 8.0, "body"),
    "cabin_co2": ("ppm", 0, 50000, 100.0, "environment"),
    "ambient_temperature": ("°C", -20, 60, 0.5, "environment"),
}
DEFAULTS = dict(
    heart_rate=67,
    systolic=116,
    diastolic=75,
    spo2=98,
    temperature=36.7,
    body_mass=72,
    sleep_hours=7.7,
    sleep_quality=86,
    activity=65,
    cabin_co2=1100,
    ambient_temperature=22,
)
DEVICES = {
    "wearable": ["heart_rate", "sleep_hours", "sleep_quality", "activity"],
    "vitals": ["systolic", "diastolic", "spo2"],
    "thermal": ["temperature"],
    "mass": ["body_mass"],
    "environment": ["cabin_co2", "ambient_temperature"],
}


def validate_reading(reading: ReadingInput):
    if reading.metric not in METRICS:
        raise ValueError("Unknown metric")
    unit, low, high, _, domain = METRICS[reading.metric]
    if reading.unit != unit or not low <= reading.value <= high or reading.domain != domain:
        raise ValueError(f"Invalid {reading.metric}: expected {low}–{high} {unit} in {domain}")
    if reading.timestamp.tzinfo is None:
        raise ValueError("Timestamp must include timezone")
    if reading.source.startswith("simulated_") != reading.simulated:
        raise ValueError("Source and simulation provenance disagree")
    return reading


class SensorAdapter(ABC):
    def connect(self):
        self.connected = True

    @abstractmethod
    def collect(self, astronaut_id, baseline, scenario, overrides): ...
    def validate(self, reading):
        return validate_reading(reading)

    def disconnect(self):
        self.connected = False


class SimulatedAdapter(SensorAdapter):
    def __init__(self, device):
        self.device, self.connected = device, False

    def collect(self, astronaut_id, baseline, scenario, overrides):
        if not self.connected:
            raise RuntimeError("Device is disconnected")
        if scenario == "sensor_fault" and self.device == "wearable":
            raise TimeoutError(
                "Wearable timed out. Retry with a working demo scenario or skip unavailable devices."
            )
        values = {**DEFAULTS, **baseline}
        if scenario == "gradual":
            values.update(
                heart_rate=values["heart_rate"] + 14,
                sleep_hours=max(0, values["sleep_hours"] - 2.3),
                sleep_quality=57,
            )
        values.update(overrides)
        return [
            self.validate(
                ReadingInput(
                    astronaut_id=astronaut_id,
                    metric=m,
                    value=round(values[m], 2),
                    unit=METRICS[m][0],
                    timestamp=now(),
                    source=f"simulated_{self.device}",
                    simulated=True,
                    domain=METRICS[m][4],
                )
            ).model_dump(mode="json")
            for m in DEVICES[self.device]
        ]


REGISTRY = {name: SimulatedAdapter for name in DEVICES}


def collect_all(astronaut_id, baseline, scenario, overrides):
    if set(overrides) - METRICS.keys():
        raise ValueError("Unknown override metric")
    readings = []
    for device, factory in REGISTRY.items():
        adapter = factory(device)
        try:
            adapter.connect()
            readings.extend(adapter.collect(astronaut_id, baseline, scenario, overrides))
        finally:
            adapter.disconnect()
    return readings


def voc_channels(index=0, scenario="normal", day=0):
    reference = [
        32 + index * 4,
        54 - index * 3,
        41 + index * 2,
        28 + index,
        62 - index * 2,
        38 + index * 3,
    ]
    return [
        round(
            v + sin(day * 0.8 + i) * 1.2 + (24 if scenario == "voc_anomaly" and i in (1, 4) else 0),
            2,
        )
        for i, v in enumerate(reference)
    ]
