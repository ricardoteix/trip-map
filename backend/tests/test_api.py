from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.services.trip_service import seed_demo_data


def setup_module():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()


def test_health_and_timeline():
    client = TestClient(app)
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    tl = client.get("/api/timeline")
    assert tl.status_code == 200
    data = tl.json()
    assert data["total_count"] >= 10
    assert data["geotagged_count"] >= 9
    assert data["untagged_count"] >= 1
    assert 2025 in data["years"]
    assert 2026 in data["years"]


def test_boolean_and_or_people_filter():
    client = TestClient(app)
    people_res = client.get("/api/people")
    assert people_res.status_code == 200
    people = people_res.json()
    by_name = {p["name"]: p["id"] for p in people}

    for expected in ("Ricardo", "Saulo", "Michele", "Lorena"):
        assert expected in by_name

    four_ids = ",".join([by_name["Ricardo"], by_name["Saulo"], by_name["Michele"], by_name["Lorena"]])

    # Strict AND filter: only photos containing all 4 people simultaneously
    and_res = client.get(f"/api/media?person_ids={four_ids}&people_mode=AND")
    assert and_res.status_code == 200
    and_items = and_res.json()
    assert len(and_items) == 5
    for item in and_items:
        names_in_photo = {p["name"] for p in item["people"]}
        assert {"Ricardo", "Saulo", "Michele", "Lorena"}.issubset(names_in_photo)

    # OR filter: photos containing at least one of the 4 people
    or_res = client.get(f"/api/media?person_ids={four_ids}&people_mode=OR")
    assert or_res.status_code == 200
    or_items = or_res.json()
    assert len(or_items) >= 10


def test_trips_and_batch_geotagging():
    client = TestClient(app)
    trips_res = client.get("/api/trips")
    assert trips_res.status_code == 200
    trips = trips_res.json()
    assert len(trips) >= 3

    # Fetch untagged photo and assign coordinates via batch-location endpoint
    untagged_res = client.get("/api/media?untagged_only=true")
    assert untagged_res.status_code == 200
    untagged = untagged_res.json()
    assert len(untagged) >= 1
    target_id = untagged[0]["id"]

    patch_res = client.patch(
        "/api/media/batch-location",
        json={
            "media_ids": [target_id],
            "latitude": 48.8584,
            "longitude": 2.2945,
            "location_name": "Torre Eiffel, Paris",
        },
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert len(updated) == 1
    assert updated[0]["latitude"] == 48.8584
    assert updated[0]["longitude"] == 2.2945
    assert updated[0]["is_manual_location"] is True
