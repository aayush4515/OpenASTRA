# ASTRA

**Autonomous Space Telehealth & Risk Assessment** — a locally runnable prototype for a fictional deep-space mission, built for the NASA Space Apps project brief. Not affiliated with or endorsed by NASA; not a clinically validated medical device.

ASTRA connects a procedural 3D medical station, webcam landmark processing, deterministic sensor simulations, personalized statistics, a questionnaire, weekly laboratory simulations and delayed Mission Control reports through one SQLite-backed workflow.

## Run it

Requirements: **Python 3.11+**, **Node 22.12+** (Node 24 recommended), npm, and a recent Chromium/Firefox browser. Setup needs internet; operation after setup does not. A webcam is optional. WebGL 2 is recommended for the 3D booth. No API keys, cloud database or paid service is required.

From this repository:

```bash
./scripts/setup.sh
./scripts/run.sh
```

Open **http://127.0.0.1:8010**. The production frontend, models, WASM and API are served by the same FastAPI process. The database initializes and seeds automatically on first startup. To stop, press Ctrl+C. Restart with the same command to retain records.

If dependencies are already installed in this workspace:

```bash
./scripts/node-runtime.sh npm --prefix frontend run build
./scripts/run.sh
```

The Node wrapper uses an installed supported Node, or the existing Codex-bundled Node runtime if the system Node is older. It does not install or alter a global Node version. `.nvmrc` specifies Node 24 for nvm users.

### Development mode

```bash
./scripts/dev.sh
```

Open http://127.0.0.1:5173. Vite proxies `/api` to port 8010. Alternatively, run these in two terminals:

```bash
# Terminal 1, repository root
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8010 --reload

# Terminal 2, repository root
./scripts/node-runtime.sh npm --prefix frontend run dev
```

### Manual setup

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock.txt
./scripts/node-runtime.sh npm --prefix frontend ci
./scripts/node-runtime.sh npm --prefix frontend run models
./scripts/node-runtime.sh npm --prefix frontend run build
./scripts/run.sh
```

`npm run models` copies the package's MediaPipe WASM files and downloads Google's versioned Face Landmarker model into `frontend/public/`. These generated assets are ignored by Git and must be installed before taking the station offline. They are included in the production build. Camera failure is non-blocking if assets are absent.

Use `ASTRA_PORT=8012 ./scripts/run.sh` to change the production port. To select another **SQLite** file, set `ASTRA_DATABASE_URL=sqlite:////absolute/path/astra.db` before starting. The default database is `backend/astra.db`; no other database engine is accepted. The development proxy expects port 8010.

## What is implemented

| Capability             | Actual behavior                                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mission home           | Live local crew summary, observations, reminders and link status; responsive navigation                                                                                                                                             |
| 3D station             | Procedural astronaut and station; orbit/zoom; selectable camera, thermal, wearable, vitals, inertial-mass, e-nose and lab modules; state-driven scan animation; keyboard equipment controls; WebGL fallback                         |
| Daily check-in         | Server-authoritative state machine, explicit identity confirmation, optional camera, deterministic sensors, VOC channels, branching questionnaire, atomic assessment save, report creation, retry/cancel and refresh recovery       |
| Webcam                 | Real `getUserMedia` video and local MediaPipe inference; landmark overlay; pose, light, distance and stability gates; camera release on stop/unmount; consent-based storage of derived ratios only                                  |
| Facial reference       | Enrollment and comparison against the first three valid same-source captures; synthetic fixtures never become live reference history; explicit inadequate/insufficient-history states                                               |
| Sensors                | Typed adapter interface, registry, validation, per-reading provenance, adjustable pulse/sleep, fault scenario, and a shared future-hardware ingestion endpoint                                                                      |
| Intelligence           | Personal median/MAD references, recent slopes, relative deviations, combined resting-pulse/sleep/fatigue rule, self-reported symptoms/mood, facial changes, VOC channels and lab-change review; persisted explanations and guidance |
| New-profile references | After seven eligible normal simulated check-ins, a reference is established with initial outlier exclusion and then frozen; anomalous scenarios are excluded                                                                        |
| Health dashboard       | Saved assessment selection, 35-reading trend charts, interactive keyboard-accessible body regions, live facial history, VOC chart, cabin/body separation and lab history                                                            |
| Weekly labs            | Persisted configurable schedule; prepare → load synthetic sample → analyze → save; hemoglobin, glucose and white-cell illustrative values; report queue and next reminder update                                                    |
| Emergency              | Immediately accessible local workflow, chest pain/collapse and other event types, predefined crew-first priorities, on-screen simulated alert, event log and queued report                                                          |
| Mission Control        | Simplified role gate, delivered reports, crew roster, lab/emergency payloads, acknowledgments, persistent transport history, link outages and configurable delay                                                                    |
| Privacy controls       | Local profile creation/update/deletion; facial-reference/measurement deletion; no raw photos, audio or identity embeddings retained; explicitly confirmed synthetic-demo reset                                                      |
| Offline operation      | Local assets, models, SQLite, analysis and communications; no runtime cloud calls for core workflows                                                                                                                                |

## Real, simulated and unavailable

**Real software paths:** webcam video acquisition and MediaPipe inference, landmark geometry, personal-history calculations, user-entered questionnaire responses, database transactions, scheduling and persisted queue transitions. The live camera implementation is present but was **not exercised with a physical webcam during this implementation session**.

**Simulated:** all vital signs, temperature, body mass, wearable data, cabin data, VOC channels, blood results, crew alarm and Earth communications. Every saved sensor reading includes its astronaut, metric, units, timestamp, source, quality, context, domain and simulation flag. Lab and facial records carry their corresponding provenance. No physical medical equipment is connected.

**Identity is manually confirmed.** Face detection is not identity recognition. Reliable biometric identity matching/embeddings and photograph comparison were deliberately not implemented. Facial enrollment establishes geometry references, not a verified identity template.

**Speech recognition is not implemented.** Typed answers and selectable options are the reliable offline input path; no microphone is activated. There is no browser-cloud speech fallback masquerading as offline speech.

MediaPipe runs in the browser rather than Python/OpenCV. This small stack adjustment keeps raw camera frames off the API and avoids a second webcam pipeline. NumPy powers the statistical engine; pandas and scikit-learn are installed for the requested research stack but no unvalidated learned diagnostic model is used. OpenPOM is not integrated.

## Demo mode

The initial database contains three fictional crew members and 28 days of synthetic sensor/VOC history, personal reference statistics, weekly lab history and isolated synthetic facial fixtures. The first 21 days establish seeded references. Rafael's final five days demonstrate gradual pulse/sleep changes. Dates are anchored to initial startup; readings do not change on render.

In **Assessment booth**, choose:

- **A — Routine:** measurements near the selected astronaut's own reference.
- **B — Rest & recovery change:** higher pulse and shorter sleep; report unusual fatigue to trigger the combined observation.
- **C — Facial geometry:** use the real camera or the separately labeled synthetic eyelid-change fixture.
- **D — VOC change:** two synthetic e-nose channels depart from the reference.
- **Sensor unavailable:** deterministic wearable timeout; retry remains faulty until the scenario is changed, or explicitly skip sensors and finish with missing-data disclosure.

Weekly labs, emergencies and communication outages are separate workflows. Follow [docs/DEMO.md](docs/DEMO.md) for the presentation sequence.

To reset the demo, select the **Mission Control demo role**, visit **Station settings**, type `RESET SYNTHETIC DEMO`, and activate the reset. Only fictional crew and their linked records are rebuilt; user-created profiles are preserved. Existing settings are retained. Ordinary restarts never reset history or recreate intentionally deleted crew.

## Tests and verification

```bash
./scripts/test.sh
```

Or individually:

```bash
.venv/bin/python -m pytest backend/tests -q
./scripts/node-runtime.sh npm --prefix frontend test
./scripts/node-runtime.sh npm --prefix frontend run build
```

Backend tests use separate temporary SQLite databases and FastAPI TestClient. Frontend tests use React Testing Library/Vitest with controlled API and hardware boundaries, including a complete routed manual-camera-fallback check-in, ground-role controls, emergency activation, questionnaire branching, lab transitions and record switching. These are component/integration tests, not a substitute for browser rendering or hardware validation.

A separate **Playwright acceptance suite is provided but was not executed in this session** because the browser permission gate declined opening the local preview. It covers the integrated demo, camera denial, routes and desktop/narrow overflow. It starts a disposable SQLite-backed server on port 8011 and uses installed Google Chrome:

```bash
./scripts/node-runtime.sh npm --prefix frontend run test:e2e
```

Build first and install Chrome if needed. The browser suite never uses your default database. Manual webcam, graphics, small-screen and visual review remain release checks. See [docs/TESTING.md](docs/TESTING.md) for the verification ledger and remaining checks.

## Architecture and API

- `frontend/src/pages/`: route-level screens.
- `frontend/src/features/`: procedural 3D, camera, questionnaire, body map and lab workflows.
- `frontend/src/services/`: shared TypeScript contracts and API/loading/error handling.
- `backend/app/models.py`: related SQLAlchemy records with SQLite foreign keys and indexes.
- `backend/app/services/`: adapters, orchestration, facial comparison, analysis, question rules and communication queue.
- `backend/app/api/`: validated operations with meaningful 404/409/422/503 failures.
- `backend/app/seed.py`: deterministic fictional crew/history initialization.

OpenAPI is available at http://127.0.0.1:8010/openapi.json. FastAPI's default interactive `/docs` page uses externally hosted Swagger UI assets, so it is an optional **online developer convenience**, not part of the offline product. Full data flow and state-machine details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Scientific and medical limits

This demonstrator cannot diagnose disease or establish fitness for duty. Statistical reference deviations are not emergency thresholds. The robust-deviation rule (≥3), lab-change rule (10%) and capture-quality cutoffs are illustrative engineering choices, not NASA protocols. Guidance is predefined and unreviewed; it recommends repeat measurements or crew review, not treatments.

Ordinary webcam images do not establish edema, stroke, intracranial pressure or retinal disease. Facial geometry varies with expression, pose, camera setup and lighting. The VOC module is a synthetic fingerprint research concept, not a hormone detector or direct implementation of NASA's breath-analysis work. Laboratory results are generated numbers, not blood analysis. No bone-density hardware is represented.

NASA HRP supplies the **risk context**, not validation of ASTRA:

- [Five hazards of human spaceflight](https://www.nasa.gov/hrp/hazards/) — isolation, distance, gravity, radiation and closed environments.
- [Risks of human spaceflight](https://www.nasa.gov/hrp/risks/).
- [E-Nose research](https://www.nasa.gov/ames/space-biosciences/bioengineering-branch/e-nose/) — research context, not evidence that this simulated skin fingerprint measures health conditions.
- [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker?tab=Web) — local inference implementation reference.

## Privacy, operation and next work

Run on loopback only. The database is **not encrypted** and the role header is **not secure authentication**. Anyone with workstation or API access can inspect local records. Use fictional data for demonstrations and protect the machine with OS access controls/disk encryption. Production medical use would require authentication/authorization, encryption, threat modeling, audit/retention policy, clinical review and hardware validation.

Profile deletion cascades through related health records. Facial deletion removes enrolled references, observations and derived facial details from check-in/report payloads. SQLite/WAL pages and external backups are not securely erased by row deletion; this is not a forensic deletion guarantee. Cancelled assessments discard draft payloads. Saved records remain until explicit deletion. No notifications fire when all application processes are stopped.

Next: run the supplied browser acceptance suite and live webcam acceptance checklist; calibrate geometry across camera setups; add an optional genuinely local speech model; implement validated hardware adapters and reviewed clinical protocols; consider explicit medical-officer approval for reference updates. Do not promote the current prototype to operational medical use.
