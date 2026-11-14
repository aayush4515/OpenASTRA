from contextlib import asynccontextmanager
import asyncio
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .database import Base, engine, SessionLocal
from . import models
from .seed import seed
from .api import core, operations
from .services.communications import tick


def process_queue():
    with SessionLocal() as db:
        tick(db)
        db.commit()


async def queue_worker():
    while True:
        await asyncio.sleep(1)
        try:
            await asyncio.to_thread(process_queue)
        except Exception:
            import logging

            logging.getLogger("astra.queue").exception("Queue worker failed; will retry")


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
        db.commit()
    task = asyncio.create_task(queue_worker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="ASTRA Local Mission Health", version="0.1.0", lifespan=lifespan)
app.include_router(core.router)
app.include_router(operations.router)
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
    for name in ("models", "wasm"):
        if (DIST / name).is_dir():
            app.mount("/" + name, StaticFiles(directory=DIST / name), name=name)

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "API route not found")
        return FileResponse(DIST / "index.html")
