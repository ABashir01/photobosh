from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.assets import BackgroundDefinition, TemplateDefinition


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def _lerp_channel(start: int, end: int, factor: float) -> int:
    return round(start + (end - start) * factor)


def draw_background(width: int, height: int, background: BackgroundDefinition) -> Image.Image:
    image = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(image)
    start = hex_to_rgb(background["gradient"][0])
    end = hex_to_rgb(background["gradient"][1])
    for y in range(height):
        factor = y / max(1, height - 1)
        color = tuple(_lerp_channel(start[i], end[i], factor) for i in range(3)) + (255,)
        draw.line([(0, y), (width, y)], fill=color)

    for accent in background["accents"]:
        radius = int(min(width, height) * float(accent["radius"]))
        center_x = int(width * float(accent["x"]))
        center_y = int(height * float(accent["y"]))
        color = hex_to_rgb(str(accent["color"])) + (120,)
        draw.ellipse(
            (
                center_x - radius,
                center_y - radius,
                center_x + radius,
                center_y + radius,
            ),
            fill=color,
        )
    return image


def _resize_subject(subject: Image.Image, frame_height: int) -> Image.Image:
    copy = subject.copy()
    target_height = int(frame_height * 0.8)
    scale = target_height / max(1, copy.height)
    target_width = max(1, int(copy.width * scale))
    return copy.resize((target_width, target_height), Image.LANCZOS)


def _load_subject(path: Path, fallback_size: tuple[int, int]) -> Image.Image:
    if not path.exists():
        return Image.new("RGBA", fallback_size, (0, 0, 0, 0))
    return Image.open(path).convert("RGBA")


def render_strip(
    output_path: Path,
    background: BackgroundDefinition,
    template: TemplateDefinition,
    participant_order: list[str],
    shot_paths: dict[tuple[str, int], Path],
) -> None:
    width = 1120
    height = 1880
    margin = 60
    gutter = 26
    panel_height = 360
    paper = Image.new("RGBA", (width, height), hex_to_rgb(template["paperColor"]) + (255,))
    draw = ImageDraw.Draw(paper)
    font = ImageFont.load_default()

    draw.rounded_rectangle(
        (28, 28, width - 28, height - 28),
        radius=40,
        fill=hex_to_rgb(template["panelColor"]) + (255,),
    )
    draw.rounded_rectangle(
        (42, 42, width - 42, height - 42),
        radius=34,
        outline=hex_to_rgb(template["accentColor"]) + (255,),
        width=8,
    )
    draw.text((margin, 48), template["title"], fill=hex_to_rgb(template["textColor"]), font=font)
    timestamp = datetime.now(tz=UTC).strftime("%Y-%m-%d %H:%M UTC")
    draw.text((margin, 76), timestamp, fill=hex_to_rgb(template["textColor"]), font=font)

    frame_width = width - (margin * 2)
    for shot_index in range(4):
        frame_top = 140 + shot_index * (panel_height + gutter)
        frame_box = (margin, frame_top, margin + frame_width, frame_top + panel_height)
        frame = draw_background(frame_width, panel_height, background)
        frame_draw = ImageDraw.Draw(frame)
        frame_draw.rounded_rectangle(
            (8, 8, frame_width - 8, panel_height - 8),
            radius=26,
            outline=hex_to_rgb(template["accentColor"]) + (255,),
            width=6,
        )
        slot_centers = [int(frame_width * 0.3), int(frame_width * 0.7)]
        for participant_index, participant_id in enumerate(participant_order[:2]):
            subject = _load_subject(shot_paths[(participant_id, shot_index)], (1, 1))
            resized = _resize_subject(subject, panel_height)
            x = slot_centers[participant_index] - resized.width // 2
            y = panel_height - resized.height - 24
            frame.alpha_composite(resized, (x, y))
        paper.alpha_composite(frame, (frame_box[0], frame_box[1]))
        draw.text(
            (frame_box[0] + 20, frame_box[3] - 30),
            f"Shot {shot_index + 1}",
            fill=hex_to_rgb(template["textColor"]),
            font=font,
        )

    draw.text(
        (margin, height - 54),
        "photobosh",
        fill=hex_to_rgb(template["accentColor"]),
        font=font,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    paper.save(output_path, format="PNG")

