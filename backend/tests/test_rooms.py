from io import BytesIO

from PIL import Image


def make_png() -> bytes:
    image = Image.new("RGBA", (120, 160), (255, 0, 0, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_room_creation_and_join(client):
    created = client.post("/api/rooms").json()
    assert created["roomId"]
    joined = client.post(
        f"/api/rooms/{created['roomId']}/join",
        json={"displayName": "Host", "hostToken": created["hostToken"]},
    ).json()
    assert joined["roomState"]["participants"][0]["isHost"] is True
    assert joined["rtcConfig"]["iceServers"]


def test_room_start_requires_two_ready_participants(client):
    created = client.post("/api/rooms").json()
    host = client.post(
        f"/api/rooms/{created['roomId']}/join",
        json={"displayName": "Host", "hostToken": created["hostToken"]},
    ).json()
    guest = client.post(
        f"/api/rooms/{created['roomId']}/join",
        json={"displayName": "Guest"},
    ).json()

    client.post(
        f"/api/rooms/{created['roomId']}/ready",
        headers={"X-Participant-Token": host["participantToken"]},
        json={"ready": True},
    )
    client.post(
        f"/api/rooms/{created['roomId']}/ready",
        headers={"X-Participant-Token": guest["participantToken"]},
        json={"ready": True},
    )
    started = client.post(
        f"/api/rooms/{created['roomId']}/start",
        headers={"X-Host-Token": created["hostToken"]},
    ).json()
    assert started["phase"] == "countdown"
    assert len(started["shotSchedule"]) == 4


def test_template_preview_and_finalize(client):
    created = client.post("/api/rooms").json()
    host = client.post(
        f"/api/rooms/{created['roomId']}/join",
        json={"displayName": "Host", "hostToken": created["hostToken"]},
    ).json()
    guest = client.post(
        f"/api/rooms/{created['roomId']}/join",
        json={"displayName": "Guest"},
    ).json()

    for response in (host, guest):
        client.post(
            f"/api/rooms/{created['roomId']}/ready",
            headers={"X-Participant-Token": response["participantToken"]},
            json={"ready": True},
        )
    client.post(
        f"/api/rooms/{created['roomId']}/start",
        headers={"X-Host-Token": created["hostToken"]},
    )

    payload = make_png()
    for shot_index in range(4):
        for response in (host, guest):
            uploaded = client.post(
                f"/api/rooms/{created['roomId']}/shots/{shot_index}",
                headers={"X-Participant-Token": response["participantToken"]},
                files={"file": ("shot.png", payload, "image/png")},
            )
            assert uploaded.status_code == 200

    selected = client.post(
        f"/api/rooms/{created['roomId']}/template",
        headers={"X-Host-Token": created["hostToken"]},
        json={"templateId": "midnight-pop"},
    ).json()
    assert selected["previewStripUrl"]

    finalized = client.post(
        f"/api/rooms/{created['roomId']}/finalize",
        headers={"X-Host-Token": created["hostToken"]},
    ).json()
    assert finalized["phase"] == "final_ready"
    assert finalized["finalStripUrl"]

