from __future__ import annotations

from typing import Literal, NotRequired, TypedDict


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
    layout: NotRequired[Literal["classic", "animal_hero"]]
    heroAnimal: NotRequired[Literal["red-panda", "penguin", "lemur"]]
    heroPhoto: NotRequired[str]
    heroCropAnchorY: NotRequired[float]


BACKGROUNDS: list[BackgroundDefinition] = [
    {
        "id": "dusk-lounge",
        "name": "Soft Stone",
        "description": "A quiet warm-stone backdrop with almost no visible gradient.",
        "gradient": ["#dfd6cc", "#d4c9be"],
        "accents": [],
    },
    {
        "id": "mint-pop",
        "name": "Moss Wash",
        "description": "Muted sage tones for a more natural shared booth scene.",
        "gradient": ["#d6ddd2", "#c2ccb9"],
        "accents": [],
    },
    {
        "id": "studio-noir",
        "name": "Slate Room",
        "description": "A restrained charcoal booth backdrop with a soft tonal lift.",
        "gradient": ["#303335", "#3e4245"],
        "accents": [],
    },
]

TEMPLATES: list[TemplateDefinition] = [
    {
        "id": "red-panda-lookout",
        "name": "Red Panda Strip",
        "description": "A tall red panda habitat strip with the animal resting in the center band.",
        "paperColor": "#5a412d",
        "panelColor": "#6e5139",
        "accentColor": "#f4d6a0",
        "textColor": "#fff9ef",
        "title": "photobosh wild",
        "layout": "animal_hero",
        "heroAnimal": "red-panda",
        "heroPhoto": "red-panda.jpg",
        "heroCropAnchorY": 0.42,
    },
    {
        "id": "penguin-trail",
        "name": "Penguin Strip",
        "description": "A penguin path strip with the walker left visible in the middle section.",
        "paperColor": "#2d3439",
        "panelColor": "#374047",
        "accentColor": "#d9c49b",
        "textColor": "#f7f5ef",
        "title": "photobosh shore",
        "layout": "animal_hero",
        "heroAnimal": "penguin",
        "heroPhoto": "penguin.jpg",
        "heroCropAnchorY": 0.43,
    },
    {
        "id": "lemur-sunbeam",
        "name": "Lemur Strip",
        "description": "A lemur branch strip with the curled animal held in the middle of the layout.",
        "paperColor": "#4c4438",
        "panelColor": "#5c5448",
        "accentColor": "#dfd0aa",
        "textColor": "#fffaf2",
        "title": "photobosh habitat",
        "layout": "animal_hero",
        "heroAnimal": "lemur",
        "heroPhoto": "lemur.jpg",
        "heroCropAnchorY": 0.4,
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
