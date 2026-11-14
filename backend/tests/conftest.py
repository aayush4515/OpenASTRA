import pytest
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from backend.app.database import Base, make_engine, get_db
from backend.app.main import app
from backend.app.seed import seed


@pytest.fixture
def db_factory(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path}/test.db")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        seed(db)
        db.commit()
    yield factory
    engine.dispose()


@pytest.fixture
def client(db_factory):
    def override():
        with db_factory() as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = override
    # Avoid the application's global lifespan/database; isolate every test on its own SQLite file.
    c = TestClient(app)
    yield c
    c.close()
    app.dependency_overrides.clear()
