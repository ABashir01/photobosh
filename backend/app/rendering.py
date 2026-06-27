from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.assets import BackgroundDefinition, TemplateDefinition


ANIMAL_PHOTO_DIR = Path(__file__).resolve().parent / "animal_photos"


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
        color = hex_to_rgb(str(accent["color"])) + (110,)
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


def _rounded_panel(
    size: tuple[int, int],
    fill_color: tuple[int, int, int],
    border_color: tuple[int, int, int],
    radius: int = 28,
    border_width: int = 6,
) -> Image.Image:
    panel = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(panel)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill_color + (255,))
    draw.rounded_rectangle(
        (border_width // 2, border_width // 2, size[0] - 1 - border_width // 2, size[1] - 1 - border_width // 2),
        radius=max(0, radius - 4),
        outline=border_color + (255,),
        width=border_width,
    )
    return panel


def _cover_image(image: Image.Image, size: tuple[int, int], align_y: float = 0.5) -> Image.Image:
    source = image.convert("RGBA")
    scale = max(size[0] / max(1, source.width), size[1] / max(1, source.height))
    resized = source.resize(
        (max(1, int(source.width * scale)), max(1, int(source.height * scale))),
        Image.LANCZOS,
    )
    left = max(0, (resized.width - size[0]) // 2)
    max_top = max(0, resized.height - size[1])
    top = max(0, min(max_top, int(round(max_top * align_y))))
    return resized.crop((left, top, left + size[0], top + size[1]))


def _contain_image(image: Image.Image, size: tuple[int, int], fill: tuple[int, int, int]) -> Image.Image:
    source = image.convert("RGBA")
    scale = min(size[0] / max(1, source.width), size[1] / max(1, source.height))
    resized = source.resize(
        (max(1, int(source.width * scale)), max(1, int(source.height * scale))),
        Image.LANCZOS,
    )
    canvas = Image.new("RGBA", size, fill + (255,))
    left = (size[0] - resized.width) // 2
    top = (size[1] - resized.height) // 2
    canvas.alpha_composite(resized, (left, top))
    return canvas


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


def _load_animal_photo(template: TemplateDefinition, fallback_size: tuple[int, int]) -> Image.Image:
    hero_photo = template.get("heroPhoto")
    if not hero_photo:
        return Image.new("RGBA", fallback_size, hex_to_rgb(template["panelColor"]) + (255,))
    photo_path = ANIMAL_PHOTO_DIR / hero_photo
    if not photo_path.exists():
        return Image.new("RGBA", fallback_size, hex_to_rgb(template["panelColor"]) + (255,))
    return Image.open(photo_path).convert("RGBA")


def _load_composite_frame(
    composite_paths: dict[int, Path],
    shot_index: int,
    size: tuple[int, int],
) -> Image.Image | None:
    path = composite_paths.get(shot_index)
    if path is None or not path.exists():
        return None
    return _cover_image(Image.open(path).convert("RGBA"), size)


def _render_composited_frame(
    background: BackgroundDefinition,
    participant_order: list[str],
    shot_paths: dict[tuple[str, int], Path],
    shot_index: int,
    size: tuple[int, int],
) -> Image.Image:
    frame = draw_background(size[0], size[1], background)
    slot_centers = [int(size[0] * 0.3), int(size[0] * 0.7)]
    for participant_index, participant_id in enumerate(participant_order[:2]):
        subject = _load_subject(shot_paths[(participant_id, shot_index)], (1, 1))
        resized = _resize_subject(subject, size[1])
        x = slot_centers[participant_index] - resized.width // 2
        y = size[1] - resized.height - 18
        frame.alpha_composite(resized, (x, y))
    return frame


def _draw_photo_slot(
    paper: Image.Image,
    position: tuple[int, int],
    panel_size: tuple[int, int],
    panel_fill: tuple[int, int, int],
    border: tuple[int, int, int],
    frame_image: Image.Image,
) -> None:
    panel = _rounded_panel(panel_size, panel_fill, border)
    panel.alpha_composite(_cover_image(frame_image, (panel_size[0] - 20, panel_size[1] - 20)), (10, 10))
    paper.alpha_composite(panel, position)


def _render_classic_strip(
    paper: Image.Image,
    draw: ImageDraw.ImageDraw,
    font: ImageFont.ImageFont | ImageFont.FreeTypeFont,
    background: BackgroundDefinition,
    template: TemplateDefinition,
    participant_order: list[str],
    shot_paths: dict[tuple[str, int], Path],
    composite_paths: dict[int, Path],
) -> None:
    width, height = paper.size
    margin = 54
    top = 132
    gutter = 24
    panel_size = (width - margin * 2, 486)
    border = hex_to_rgb(template["accentColor"])
    panel_fill = hex_to_rgb(template["panelColor"])
    for shot_index in range(4):
        frame_image = _load_composite_frame(composite_paths, shot_index, (panel_size[0] - 20, panel_size[1] - 20))
        if frame_image is None:
            frame_image = _render_composited_frame(
                background,
                participant_order,
                shot_paths,
                shot_index,
                (panel_size[0] - 20, panel_size[1] - 20),
            )
        position = (margin, top + shot_index * (panel_size[1] + gutter))
        _draw_photo_slot(paper, position, panel_size, panel_fill, border, frame_image)

    timestamp = datetime.now(tz=UTC).strftime("%Y-%m-%d %H:%M UTC")
    draw.text((margin, 56), template["title"], fill=hex_to_rgb(template["textColor"]), font=font)
    draw.text((margin, 80), timestamp, fill=hex_to_rgb(template["textColor"]), font=font)
    draw.text((margin, height - 44), "photobosh", fill=border, font=font)


def _render_animal_hero_strip(
    paper: Image.Image,
    draw: ImageDraw.ImageDraw,
    font: ImageFont.ImageFont | ImageFont.FreeTypeFont,
    background: BackgroundDefinition,
    template: TemplateDefinition,
    participant_order: list[str],
    shot_paths: dict[tuple[str, int], Path],
    composite_paths: dict[int, Path],
) -> None:
    width, height = paper.size
    margin = 34
    top = 42
    gutter = 24
    photo_panel_size = (width - margin * 2, 296)
    border = hex_to_rgb(template["accentColor"])
    panel_fill = hex_to_rgb(template["panelColor"])
    hero_photo = _load_animal_photo(template, paper.size)
    crop_anchor_y = float(template.get("heroCropAnchorY", 0.5))
    paper.alpha_composite(_cover_image(hero_photo, paper.size, align_y=crop_anchor_y), (0, 0))
    overlay = Image.new("RGBA", paper.size, (18, 14, 10, 52))
    paper.alpha_composite(overlay, (0, 0))

    positions = [
        (margin, top),
        (margin, top + photo_panel_size[1] + gutter),
        (margin, top + (photo_panel_size[1] + gutter) * 2 + 362),
        (margin, top + (photo_panel_size[1] + gutter) * 3 + 362),
    ]
    for shot_index, position in enumerate(positions):
        frame_image = _load_composite_frame(
            composite_paths,
            shot_index,
            (photo_panel_size[0] - 20, photo_panel_size[1] - 20),
        )
        if frame_image is None:
            frame_image = _render_composited_frame(
                background,
                participant_order,
                shot_paths,
                shot_index,
                (photo_panel_size[0] - 20, photo_panel_size[1] - 20),
            )
        _draw_photo_slot(paper, position, photo_panel_size, panel_fill, border, frame_image)
    footer_panel = _rounded_panel((180, 38), panel_fill, border, radius=18, border_width=4)
    paper.alpha_composite(footer_panel, (width // 2 - 90, height - 56))
    draw.text((width // 2 - 32, height - 42), "photobosh", fill=border, font=font)


def render_strip(
    output_path: Path,
    background: BackgroundDefinition,
    template: TemplateDefinition,
    participant_order: list[str],
    shot_paths: dict[tuple[str, int], Path],
    composite_paths: dict[int, Path],
) -> None:
    width = 520 if template.get("layout") == "animal_hero" else 740
    height = 1760 if template.get("layout") == "animal_hero" else 2180
    paper = Image.new("RGBA", (width, height), hex_to_rgb(template["paperColor"]) + (255,))
    draw = ImageDraw.Draw(paper)
    font = ImageFont.load_default()

    if template.get("layout") == "animal_hero":
        _render_animal_hero_strip(paper, draw, font, background, template, participant_order, shot_paths, composite_paths)
    else:
        _render_classic_strip(paper, draw, font, background, template, participant_order, shot_paths, composite_paths)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    paper.save(output_path, format="PNG")
