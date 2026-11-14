# Hackathon demonstration

## Prepare

1. Run setup while online, including `npm run models`. Build and start `./scripts/run.sh`.
2. Open http://127.0.0.1:8010. Use fictional crew only. Explain the demonstration/simulation banner.
3. For a clean presentation, enter the Mission Control demo role, then reset synthetic records in Station settings using the exact confirmation phrase. This deletes live facial captures attached to the fictional profiles; do this before enrollment.
4. Verify local camera permissions and WebGL on the presentation machine. Keep the manual camera path available. Run the browser acceptance suite separately if browser access is allowed.

## 1. Mission overview — 30 seconds

Show the three fictional astronauts, reminders and seeded multiweek histories. Rafael's record contains a five-day pulse/sleep change. Open the 3D booth, orbit and zoom, and select each station module using geometry or the keyboard-accessible equipment buttons. Note the inertial mass concept and portable blood analyzer; no bone-density scanner exists.

## 2. Complete one daily assessment — 2–3 minutes

Select Maya in the header. Choose A · Routine assessment. Begin, manually confirm Maya, and open the optical module.

If a webcam is available, enable it, face forward in even lighting, hold a neutral expression and wait for accepted quality. Consent and save derived measurements. Explain that face detection is not identity recognition and no raw image is stored. First live captures will honestly report insufficient reference history. Enrollment in Station settings can add valid live reference captures; at least three prior captures are needed for change comparison.

If camera access is denied/unavailable, continue without camera. The check-in records the omission.

Collect simulated sensor readings and the experimental VOC fingerprint. Complete the subjective questions, analyze/save, finish, and open the dashboard. Show units, provenance, personal trends, body regions, date selection and explainable guidance. The health report is already a SQLite queue record.

## 3. Pattern changes — 1 minute each

**B — Rest & recovery:** choose scenario B and report unusual fatigue. A shorter-sleep follow-up appears. The resulting combined observation explains the raised pulse, shortened sleep and self-report without diagnosing a disease.

**C — Facial geometry:** use the live camera and your established references, or select the explicitly labeled synthetic facial-change fixture. The fixture produces a reduced left-eye opening ratio against synthetic reference data. It never enters live reference history. Read the pose/expression/lighting limitation aloud.

**D — VOC anomaly:** choose scenario D and complete the assessment. Two channels differ from the synthetic chemical reference. Show the radar chart and interference/repeat recommendation. Do not describe channels as hormone levels or identified chemical concentrations.

## 4. Weekly laboratory — 1 minute

Open Maya's health record and the Weekly laboratory panel. Start the simulated blood test, load the simulated sample, run analysis, and save. The station's analyzer state follows the lab workflow. Show the three generated indicators, prior values, stored history and the updated reminder. This is manual sample-workflow simulation, not an automated extraction mechanism or real analyzer.

## 5. Outage and ground handoff — 1 minute

Enter Mission Control and choose Disconnect Earth link. Queue a report or complete another check-in. The queue shows `Queued`; onboard analysis remains usable. Ground cannot open unsent payloads.

Set a short demonstration delay (for example 3 seconds), apply it, and restore the link. Observe In transit, then Delivered. Open the report and acknowledge it. Transition history is persisted. Ground roster summaries use delivered report snapshots, not unsent onboard observations.

## 6. Emergency — 45 seconds

Use the emergency link from any major screen. Select Chest pain and collapse and activate the simulation. The on-screen crew notification is immediate; the event and report are saved locally. Show the crew-first priorities and the instruction not to wait for Earth. No physical alarm is triggered and no treatment/dose is invented. Close the simulation after discussing the event log.

## 7. Persistence and independence — 30 seconds

Stop and restart the local server, then revisit the dashboard and queue. Saved check-ins, results, reminders and report history remain. Disconnect internet while leaving the local server running: application assets, models and core functionality are local. External research links and FastAPI's optional Swagger documentation page are online-only conveniences.

## Optional failure demonstration

Choose Sensor unavailable. Collection returns a real 503 from the simulated wearable adapter; no final readings are inserted. Retry remains faulty by design. Cancel and choose a working scenario, or explicitly skip sensors and complete an assessment with missing-data disclosure. An urgent emergency never depends on sensor success.

## Claims to avoid

Do not claim verified facial identity, local speech recognition, real medical measurements, hormone detection, real blood analysis, secure production authentication, flight readiness, NASA endorsement, or clinical validation. The camera implementation and 3D appearance still need target-machine acceptance testing; a synthetic fixture is not evidence of physical webcam validation.
