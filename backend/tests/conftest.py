import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("APP_BASE_URL", "http://localhost:5173")
os.environ.setdefault("TURN_PUBLIC_HOST", "turn.local")
os.environ.setdefault("TURN_USERNAME", "user")
os.environ.setdefault("TURN_PASSWORD", "pass")
os.environ.setdefault("BACKGROUND_ASSET_DIR", str(Path.cwd() / "backend-test-assets" / "backgrounds"))
os.environ.setdefault("TEMPLATE_ASSET_DIR", str(Path.cwd() / "backend-test-assets" / "templates"))
os.environ.setdefault("GENERATED_ASSET_DIR", str(Path.cwd() / "backend-test-assets" / "generated"))

from app.config import Settings
from app.main import create_app


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    settings = Settings(
        app_base_url="http://localhost:5173",
        turn_public_host="turn.local",
        turn_username="user",
        turn_password="pass",
        background_asset_dir=tmp_path / "backgrounds",
        template_asset_dir=tmp_path / "templates",
        generated_asset_dir=tmp_path / "generated",
    )
    app = create_app(settings)
    return TestClient(app)
