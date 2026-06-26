from __future__ import annotations

from typing import TypedDict


class BackgroundDefinition(TypedDict):
    id: str
    name: str
    description: str
    gradient: list[str]
    accents: list[dict[str, float | str]]


class TemplateDefinition(TypedDict):
    id: str
    name: str
    description: str
    paperColor: str
    panelColor: str
    accentColor: str
    textColor: str
    title: str


BACKGROUNDS: list[BackgroundDefinition] = [
    {
        "id": "dusk-lounge",
        "name": "Dusk Lounge",
        "description": "Warm lounge tones with soft spotlight shapes.",
        "gradient": ["#1f2a44", "#c56752"],
        "accents": [
            {"x": 0.15, "y": 0.2, "radius": 0.18, "color": "#f6d0ac"},
            {"x": 0.85, "y": 0.75, "radius": 0.22, "color": "#355070"},
        ],
    },
    {
        "id": "mint-pop",
        "name": "Mint Pop",
        "description": "Bright mint and coral for playful photostrips.",
        "gradient": ["#0d3b66", "#83c5be"],
        "accents": [
            {"x": 0.2, "y": 0.82, "radius": 0.16, "color": "#ffddd2"},
            {"x": 0.76, "y": 0.22, "radius": 0.14, "color": "#ee6c4d"},
        ],
    },
    {
        "id": "studio-noir",
        "name": "Studio Noir",
        "description": "Dark stage with cinematic contrast.",
        "gradient": ["#101820", "#314e52"],
        "accents": [
            {"x": 0.18, "y": 0.16, "radius": 0.1, "color": "#f2aa4c"},
            {"x": 0.82, "y": 0.84, "radius": 0.18, "color": "#5bc0be"},
        ],
    },
]

TEMPLATES: list[TemplateDefinition] = [
    {
        "id": "sunset-strip",
        "name": "Sunset Strip",
        "description": "Warm paper, bold coral accent, classic booth feel.",
        "paperColor": "#fff7ef",
        "panelColor": "#f7d6c0",
        "accentColor": "#e76f51",
        "textColor": "#3d405b",
        "title": "Together, remotely",
    },
    {
        "id": "midnight-pop",
        "name": "Midnight Pop",
        "description": "Dark panel and bright cyan lines for a punchier finish.",
        "paperColor": "#101820",
        "panelColor": "#1d3557",
        "accentColor": "#7bdff2",
        "textColor": "#f1faee",
        "title": "Photobosh nights",
    },
    {
        "id": "cream-soda",
        "name": "Cream Soda",
        "description": "Soft pastel strip with playful green framing.",
        "paperColor": "#fffdf6",
        "panelColor": "#d9ed92",
        "accentColor": "#52b788",
        "textColor": "#2d3142",
        "title": "Same booth, two places",
    },
]


def list_backgrounds() -> list[BackgroundDefinition]:
    return BACKGROUNDS


def list_templates() -> list[TemplateDefinition]:
    return TEMPLATES


def get_background(background_id: str) -> BackgroundDefinition:
    for background in BACKGROUNDS:
        if background["id"] == background_id:
            return background
    raise KeyError(background_id)


def get_template(template_id: str) -> TemplateDefinition:
    for template in TEMPLATES:
        if template["id"] == template_id:
            return template
    raise KeyError(template_id)

