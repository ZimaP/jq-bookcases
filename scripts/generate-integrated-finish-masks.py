"""Build deterministic wood-only finish mattes for guided previews.

The previous renderer could fall back to coarse SVG rectangles, so changing a
finish recolored every room, prop, and hardware pixel inside the box. Each v3
matte now has two reviewed source-resolution inputs:

* an installation matte containing the cabinet/material silhouette;
* a protected-content matte containing decor, books, plants, art, screens,
  cushions, lights, hardware, grille voids, and any room/floor spill.

The final finish matte is their exact grayscale difference. Runtime code only
accepts explicitly mapped v3 assets and fails closed for unknown sources.
This file covers the 36 non-bookcase integrated previews and seven shared
concept sources; Bookcase scenes use their dedicated generator.
"""

from argparse import ArgumentParser
import json
from pathlib import Path
import re

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = PROJECT_ROOT / "assets/photos/configurator"
OUTPUT_VERSION = 3
INSTALLATION_VERSION = 1
OBJECT_EXCLUSION_VERSION = 1
EXCLUSION_MANIFEST_PATHS = (
    PROJECT_ROOT / "scripts/finish-mask-exclusions-tv-generic.json",
    PROJECT_ROOT / "scripts/finish-mask-exclusions-floating-window.json",
)
ENVELOPE_MANIFEST_PATHS = (
    PROJECT_ROOT / "scripts/finish-mask-envelopes-tv-window.json",
    PROJECT_ROOT / "scripts/finish-mask-envelopes-floating.json",
    PROJECT_ROOT / "scripts/finish-mask-envelopes-radiator.json",
)
LAYOUTS = (
    "niche-layout",
    "left-niche",
    "right-niche",
    "clear-wall",
    "fireplace-wall",
    "center-recess",
    "window-wall",
    "door-wall",
    "corner-wall",
    "double-opening",
)
HARDWARE_LABEL_TOKENS = ("hardware", "handle", "knob", "pull")

# One public style from each non-bookcase product family is exposed on Step 1.
# Native scenes use the generic sources below; every other layout is integrated.
FAMILIES = {
    "tv-unit": {
        "style": "framed-tv-wall",
        "native": {"clear-wall": "concept-tv-wall-v1.png"},
        "source_versions": {"double-opening": 2},
        "spatial_versions": {},
        "material": "warm",
    },
    "floating-storage": {
        "style": "floating-drawer-bank",
        "native": {"clear-wall": "product-floating-storage-v1.png"},
        "source_versions": {"double-opening": 3},
        "spatial_versions": {},
        "material": "warm",
    },
    "window-storage": {
        "style": "window-seat-storage",
        "native": {"window-wall": "concept-window-cabinets-v1.png"},
        "source_versions": {"clear-wall": 2, "double-opening": 2},
        "spatial_versions": {"clear-wall": 2},
        "material": "warm",
    },
    "radiator-cover": {
        "style": "clean-slat-cover",
        "native": {"window-wall": "product-radiator-cover-v1.png"},
        "source_versions": {"double-opening": 2},
        "spatial_versions": {},
        "material": "neutral",
    },
}

# These seven unique sources backed the eight active inline-mask states.
# Coordinates mirror the previous installation geometry, but now serve only as
# a coarse candidate region. The source-pixel classifier creates the true matte.
GENERIC_GEOMETRY = {
    "concept-window-cabinets-v1.png": {
        "material": "warm",
        "envelope": {
            "rectangles": (
                (107, 75, 1233, 81),
                (109, 120, 369, 635),
                (977, 120, 362, 635),
                (97, 748, 1253, 219),
            ),
        },
        "rectangles": (
            (107, 75, 1233, 81),
            (109, 120, 45, 635),
            (436, 120, 42, 635),
            (977, 120, 42, 635),
            (1294, 120, 45, 635),
            (117, 120, 1215, 36),
            (126, 286, 326, 24),
            (998, 286, 322, 24),
            (126, 438, 326, 24),
            (998, 438, 322, 24),
            (126, 587, 326, 24),
            (998, 587, 322, 24),
            (126, 738, 326, 24),
            (998, 738, 322, 24),
            (97, 748, 1253, 219),
        ),
    },
    "concept-cabinets-shelves-between-openings-v1.png": {
        "material": "warm",
        "envelope": {"rectangles": ((365, 148, 799, 654),)},
        "rectangles": (
            (369, 148, 794, 58),
            (365, 183, 37, 417),
            (758, 183, 31, 417),
            (1127, 183, 37, 417),
            (390, 184, 750, 27),
            (392, 290, 744, 22),
            (392, 397, 744, 22),
            (392, 496, 744, 22),
            (365, 594, 799, 207),
            (365, 782, 799, 20),
        ),
    },
    "concept-drawers-shelves-between-openings-v1.png": {
        "material": "warm",
        "envelope": {"rectangles": ((389, 147, 757, 643),)},
        "rectangles": (
            (389, 147, 756, 58),
            (389, 187, 33, 431),
            (746, 187, 31, 431),
            (1113, 187, 33, 431),
            (410, 189, 711, 26),
            (411, 299, 708, 22),
            (411, 404, 708, 22),
            (411, 500, 708, 22),
            (389, 612, 757, 176),
            (389, 770, 757, 20),
        ),
    },
    "concept-full-shelving-between-openings-v1.png": {
        "material": "warm",
        "envelope": {"rectangles": ((324, 168, 885, 648),)},
        "rectangles": (
            (324, 168, 885, 50),
            (332, 198, 34, 594),
            (620, 198, 31, 594),
            (890, 198, 31, 594),
            (1175, 198, 34, 594),
            (352, 199, 835, 25),
            (354, 305, 830, 21),
            (354, 407, 830, 21),
            (354, 500, 830, 21),
            (354, 599, 830, 21),
            (354, 690, 830, 21),
            (354, 779, 830, 21),
            (332, 787, 877, 29),
        ),
    },
    "concept-tv-wall-v1.png": {
        "material": "warm",
        "envelope": {"rectangles": ((157, 53, 1236, 876),)},
        "rectangles": (
            (166, 53, 1227, 75),
            (174, 103, 43, 543),
            (480, 103, 38, 543),
            (906, 103, 39, 543),
            (1334, 103, 43, 543),
            (196, 103, 1155, 39),
            (200, 245, 1149, 25),
            (200, 373, 301, 25),
            (929, 373, 420, 25),
            (200, 503, 301, 25),
            (929, 503, 420, 25),
            (493, 339, 465, 30),
            (493, 339, 28, 306),
            (930, 339, 28, 306),
            (493, 615, 465, 30),
            (200, 631, 1149, 21),
            (157, 643, 1231, 286),
        ),
    },
    "product-floating-storage-v1.png": {
        "material": "warm",
        "rectangles": (
            (241, 484, 1065, 25),
            (241, 484, 28, 66),
            (1278, 484, 28, 66),
            (269, 532, 1009, 20),
            (190, 548, 1142, 217),
        ),
    },
    "product-radiator-cover-v1.png": {
        "material": "neutral",
        "rectangles": (
            (113, 389, 1307, 31),
            (126, 414, 1277, 426),
        ),
    },
}

# Named protected objects for the exact customer-reported source. The mask
# already rejects most neutral/green/dark props by color; these shapes also
# protect wood-colored decor that could otherwise pass the material classifier.
EXCLUSIONS = {
    "integrated/floating-storage/floating-drawer-bank/right-niche-v1.png": {
        "rectangles": (
            {"label": "artwork and wood frame", "xywh": (1023, 252, 191, 238)},
            {"label": "books", "xywh": (668, 525, 114, 31)},
        ),
        "ellipses": (
            {"label": "vase", "bounds": (285, 403, 406, 557)},
            {"label": "bowl", "bounds": (398, 510, 498, 557)},
            {"label": "small vessel", "bounds": (803, 507, 861, 558)},
            {"label": "lamp shade", "bounds": (1194, 393, 1312, 481)},
            {"label": "lamp base", "bounds": (1225, 444, 1288, 558)},
        ),
    },
}

# These authored witness pixels are deliberately named after customer-visible
# non-wood surfaces. They make `--check` reject a deterministic but semantically
# wrong matte, including the exact Floating Storage scene from the bug report.
QUALITY_PROBES = {
    "integrated/floating-storage/floating-drawer-bank/right-niche-v1.png": {
        "protected": {
            "wall": (800, 460),
            "vase": (350, 480),
            "books": (710, 540),
            "lamp": (1250, 500),
            "hardware": (615, 620),
            "baseboard": (800, 850),
        },
        "wood": {"drawer front": (700, 700)},
    },
    "integrated/tv-unit/framed-tv-wall/right-niche-v1.png": {
        "protected": {
            "vase": (370, 305),
            "plant pot": (935, 300),
            "books": (1090, 420),
            "basket": (1100, 610),
            "hardware": (415, 682),
            "television left": (500, 450),
            "television center": (750, 450),
            "television right": (968, 450),
            "wall": (100, 500),
            "left wall beside stile": (245, 450),
        },
        "wood": {
            "crown": (400, 190),
            "left stile": (270, 450),
            "right stile": (1200, 450),
            "shelf backing": (700, 250),
            "wood immediately right of television": (970, 450),
            "right reveal beside television": (1000, 450),
            "right shelf backing beside television": (1030, 450),
            "base": (500, 800),
        },
    },
    "integrated/tv-unit/framed-tv-wall/left-niche-v1.png": {
        "protected": {"right wall": (1350, 400)},
        "wood": {
            "exposed left side": (320, 400),
            "upper left side": (330, 250),
            "crown": (700, 180),
            "base": (700, 850),
        },
    },
    "integrated/tv-unit/framed-tv-wall/niche-layout-v1.png": {
        "protected": {
            "right wall upper": (1260, 250),
            "right wall middle": (1270, 400),
        },
        "wood": {
            "crown": (700, 140),
            "left stile": (280, 400),
            "right stile": (1250, 400),
            "backing": (700, 250),
            "base": (700, 820),
        },
    },
    "integrated/tv-unit/framed-tv-wall/door-wall-v1.png": {
        "protected": {
            "far left wall": (30, 150),
            "wall left of door": (680, 170),
            "wall right of door": (940, 160),
            "far right wall": (1510, 150),
        },
        "wood": {
            "left crown": (300, 100),
            "left backing": (300, 220),
            "left side return": (60, 400),
            "left base": (300, 850),
            "right crown": (1200, 100),
            "right backing": (1200, 220),
            "right side return": (1480, 400),
            "right base": (1200, 850),
        },
    },
    "integrated/tv-unit/framed-tv-wall/fireplace-wall-v1.png": {
        "protected": {"left wall": (30, 350)},
        "wood": {
            "left crown": (100, 150),
            "left backing": (300, 400),
            "left base": (100, 850),
            "right crown": (1100, 150),
            "right backing": (1200, 400),
            "right base": (1450, 850),
        },
    },
    "integrated/window-storage/window-seat-storage/right-niche-v1.png": {
        "protected": {
            "vase": (300, 270),
            "books": (385, 270),
            "window": (1020, 260),
            "cushion": (1025, 500),
            "plant": (600, 650),
            "hardware": (515, 789),
            "wall": (100, 500),
        },
        "wood": {"drawer face": (600, 760)},
    },
    "integrated/window-storage/window-seat-storage/niche-layout-v1.png": {
        "protected": {
            "left upper wall": (540, 170),
            "left middle wall": (550, 250),
            "left lower wall": (540, 500),
            "right upper wall": (990, 170),
            "right middle wall": (980, 250),
        },
        "wood": {
            "left upper return": (515, 200),
            "left lower return": (515, 400),
            "right upper return": (1010, 200),
            "right lower return": (1010, 400),
            "left crown": (400, 130),
            "left backing": (400, 250),
            "left base": (450, 820),
            "right base": (1100, 820),
            "bench": (700, 800),
        },
    },
    "integrated/window-storage/window-seat-storage/fireplace-wall-v1.png": {
        "protected": {
            "wall beside left tower": (400, 200),
            "wall outside right tower": (1450, 200),
        },
        "wood": {
            "left valance": (250, 100),
            "left tower": (440, 400),
            "left bench base": (250, 850),
            "right crown": (1200, 100),
            "right backing": (1200, 400),
            "right base": (1200, 850),
        },
    },
    "integrated/radiator-cover/clean-slat-cover/right-niche-v1.png": {
        "protected": {
            "vase": (285, 545),
            "bowl": (900, 565),
            "grille gap": (306, 680),
            "vent gap": (500, 866),
            "wall": (1100, 700),
        },
        "wood": {
            "grille slat": (300, 680),
            "side panel": (950, 700),
        },
    },
    "concept-cabinets-shelves-between-openings-v1.png": {
        "protected": {
            "left room wall": (200, 500),
            "left top vase": (495, 255),
            "right top vase": (860, 250),
            "right bowl": (865, 370),
            "plant pot": (470, 468),
            "basket": (1020, 570),
        },
        "wood": {
            "top shelf face": (600, 210),
            "left shelf backing": (600, 250),
            "right shelf backing": (900, 350),
            "cabinet face": (600, 700),
        },
    },
    "concept-drawers-shelves-between-openings-v1.png": {
        "protected": {
            "left room wall": (200, 500),
            "left top vase": (525, 260),
            "right bowl": (865, 380),
            "right shelf decor": (1015, 480),
            "basket": (1010, 585),
        },
        "wood": {
            "top shelf face": (600, 215),
            "left shelf backing": (600, 250),
            "right shelf backing": (900, 350),
            "drawer face": (600, 700),
        },
    },
    "concept-full-shelving-between-openings-v1.png": {
        "protected": {
            "left room wall": (200, 500),
            "left room-wall edge": (325, 500),
            "right base wall return": (1205, 802),
            "left plant pot": (410, 380),
            "center bowl": (770, 470),
            "left basket": (550, 660),
            "right basket": (1100, 750),
        },
        "wood": {
            "left shelf backing": (500, 250),
            "center shelf backing": (800, 350),
            "middle shelf face": (500, 615),
            "base": (800, 800),
        },
    },
    "concept-tv-wall-v1.png": {
        "protected": {
            "top bowl": (700, 210),
            "top vase": (1040, 210),
            "top books": (1200, 240),
            "right bowl": (1220, 350),
            "plant pot": (315, 480),
            "basket": (1220, 610),
        },
        "wood": {
            "right shelf backing": (1100, 320),
            "left shelf backing": (400, 200),
        },
    },
    "concept-window-cabinets-v1.png": {
        "protected": {
            "left top books": (238, 265),
            "left top vase": (365, 254),
            "right top plant pot": (1068, 253),
            "left basket": (315, 708),
            "right basket": (1170, 706),
            "left middle books": (322, 414),
        },
        "wood": {
            "left shelf backing": (320, 200),
            "right shelf backing": (1150, 320),
        },
    },
}


def authored_exclusions():
    entries = {}
    for path in EXCLUSION_MANIFEST_PATHS:
        if not path.exists():
            raise FileNotFoundError(f"Missing authored finish-mask exclusions: {path}")
        payload = json.loads(path.read_text())
        if payload.get("schemaVersion") != 1 or not isinstance(payload.get("entries"), dict):
            raise ValueError(f"Unsupported finish-mask exclusion manifest: {path}")
        overlap = set(entries) & set(payload["entries"])
        if overlap:
            raise ValueError(f"Duplicate finish-mask exclusion sources: {sorted(overlap)}")
        entries.update(payload["entries"])
    return entries


AUTHORED_EXCLUSIONS = None
AUTHORED_ENVELOPES = None


def authored_envelopes():
    entries = {}
    for path in ENVELOPE_MANIFEST_PATHS:
        if not path.exists():
            raise FileNotFoundError(f"Missing authored finish-mask envelopes: {path}")
        payload = json.loads(path.read_text())
        if payload.get("schemaVersion") != 1 or not isinstance(payload.get("entries"), dict):
            raise ValueError(f"Unsupported finish-mask envelope manifest: {path}")
        overlap = set(entries) & set(payload["entries"])
        if overlap:
            raise ValueError(f"Duplicate finish-mask envelope sources: {sorted(overlap)}")
        entries.update(payload["entries"])
    return entries


def output_path(source):
    name = re.sub(r"-v\d+\.png$", f"-finish-mask-v{OUTPUT_VERSION}.png", source.name)
    return source.with_name(name)


def object_exclusion_path(source):
    name = re.sub(
        r"-v\d+\.png$",
        f"-finish-exclusions-v{OBJECT_EXCLUSION_VERSION}.png",
        source.name,
    )
    return source.with_name(name)


def installation_matte_path(source):
    name = re.sub(
        r"-v\d+\.png$",
        f"-finish-installation-v{INSTALLATION_VERSION}.png",
        source.name,
    )
    return source.with_name(name)


def geometry_mask(size, definition):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for x, y, width, height in definition.get("rectangles", ()):
        draw.rectangle((x, y, x + width - 1, y + height - 1), fill=255)
    for points in definition.get("polygons", ()):
        draw.polygon(points, fill=255)
    for x, y, width, height in definition.get("cutouts", ()):
        draw.rectangle((x, y, x + width - 1, y + height - 1), fill=0)
    return mask


def installation_envelope(source, size):
    """Return the cabinet footprint; room pixels are impossible by contract."""

    global AUTHORED_ENVELOPES
    if AUTHORED_ENVELOPES is None:
        AUTHORED_ENVELOPES = authored_envelopes()
    relative = source.relative_to(ASSET_ROOT).as_posix()
    definition = AUTHORED_ENVELOPES.get(relative)
    if definition is None:
        return np.ones((size[1], size[0]), dtype=bool)
    included = np.zeros((size[1], size[0]), dtype=bool)
    for specification in definition.get("rectangles", ()):
        included |= np.asarray(shape_mask(size, "rectangle", specification)) > 0
    for specification in (
        *definition.get("polygons", ()),
        *definition.get("includePolygons", ()),
    ):
        included |= np.asarray(shape_mask(size, "polygon", specification)) > 0
    return included


def shape_mask(size, kind, specification):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    if kind == "rectangle":
        values = specification.get("xywh", specification) if isinstance(specification, dict) else specification
        x, y, width, height = values
        draw.rectangle((x, y, x + width - 1, y + height - 1), fill=255)
    elif kind == "ellipse":
        values = specification.get("bounds", specification) if isinstance(specification, dict) else specification
        draw.ellipse(tuple(values), fill=255)
    else:
        points = specification.get("points", specification) if isinstance(specification, dict) else specification
        draw.polygon(tuple(tuple(point) for point in points), fill=255)
    return mask


def semantic_object_pixels(image, selected, shape, threshold=18, expand=0):
    """Resolve an authored object region without punching a box through wood.

    The geometry tells us where a non-wood object lives. Per-row and per-column
    samples immediately outside that geometry model the continuing wood plane;
    only pixels that differ from both local models are protected from finish.
    """

    bounds = shape.getbbox()
    if not bounds:
        return np.zeros_like(selected)
    left, top, right, bottom = bounds
    rgb = np.asarray(image).astype(np.float32)
    local = rgb[top:bottom, left:right]
    local_shape = np.asarray(shape.crop(bounds)) > 0
    row_distance = np.full(local.shape[:2], np.inf, dtype=np.float32)
    for local_y, y in enumerate(range(top, bottom)):
        if left > 0:
            background = np.median(rgb[y, max(0, left - 12):left], axis=0)
            row_distance[local_y] = np.minimum(
                row_distance[local_y],
                np.sqrt(np.sum((local[local_y] - background) ** 2, axis=1)),
            )
        if right < image.width:
            background = np.median(
                rgb[y, right:min(image.width, right + 12)], axis=0
            )
            row_distance[local_y] = np.minimum(
                row_distance[local_y],
                np.sqrt(np.sum((local[local_y] - background) ** 2, axis=1)),
            )
    column_distance = np.full(local.shape[:2], np.inf, dtype=np.float32)
    for local_x, x in enumerate(range(left, right)):
        if top > 0:
            background = np.median(rgb[max(0, top - 12):top, x], axis=0)
            column_distance[:, local_x] = np.minimum(
                column_distance[:, local_x],
                np.sqrt(np.sum((local[:, local_x] - background) ** 2, axis=1)),
            )
        if bottom < image.height:
            background = np.median(
                rgb[bottom:min(image.height, bottom + 12), x], axis=0
            )
            column_distance[:, local_x] = np.minimum(
                column_distance[:, local_x],
                np.sqrt(np.sum((local[:, local_x] - background) ** 2, axis=1)),
            )
    different = local_shape & (np.minimum(row_distance, column_distance) >= threshold)
    refined = Image.fromarray(np.where(different, 255, 0).astype(np.uint8), mode="L")
    refined = refined.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    if expand:
        refined = refined.filter(ImageFilter.MaxFilter(expand * 2 + 1))
        refined = Image.fromarray(
            np.where((np.asarray(refined) > 0) & local_shape, 255, 0).astype(np.uint8),
            mode="L",
        )
    output = np.zeros_like(selected)
    output[top:bottom, left:right] = np.asarray(refined) > 0
    return output


def exclusion_mask(source, image, selected):
    global AUTHORED_EXCLUSIONS
    relative = source.relative_to(ASSET_ROOT).as_posix()
    if AUTHORED_EXCLUSIONS is None:
        AUTHORED_EXCLUSIONS = authored_exclusions()
    object_matte_path = object_exclusion_path(source)
    if object_matte_path.exists():
        object_matte = Image.open(object_matte_path).convert("L")
        if object_matte.size != image.size:
            raise ValueError(
                f"{object_matte_path.relative_to(PROJECT_ROOT)} and its source differ"
            )
        return np.asarray(object_matte) > 0

    excluded = np.zeros_like(selected)

    direct = EXCLUSIONS.get(relative, {})
    full_region_tokens = (
        "spill",
        "television",
        "screen",
        "soundbar",
        "emitter",
        "artwork",
        "cushion",
        "fabric",
    )
    for plural, kind in (
        ("rectangles", "rectangle"),
        ("ellipses", "ellipse"),
        ("polygons", "polygon"),
    ):
        for specification in direct.get(plural, ()):
            shape = shape_mask(image.size, kind, specification)
            # These few shapes are hand-fitted to the exact customer-reported
            # scene, so they are already silhouettes rather than search boxes.
            excluded |= np.asarray(shape) > 0

    authored = AUTHORED_EXCLUSIONS.get(relative, {})
    for plural, kind in (
        ("rectangles", "rectangle"),
        ("ellipses", "ellipse"),
        ("polygons", "polygon"),
    ):
        for specification in authored.get(plural, ()):
            shape = shape_mask(image.size, kind, specification)
            if not isinstance(specification, dict):
                excluded |= np.asarray(shape) > 0
                continue
            label = str(specification.get("label", "")).lower()
            if specification.get("mode") == "full" or any(
                token in label for token in full_region_tokens
            ):
                excluded |= np.asarray(shape) > 0
            else:
                hardware_like = any(token in label for token in HARDWARE_LABEL_TOKENS)
                compact_shape = False
                if kind == "rectangle":
                    _, _, width, height = specification.get("xywh", specification)
                    compact_shape = width <= 120 and height <= 30
                elif kind == "ellipse":
                    left, top, right, bottom = specification.get("bounds", specification)
                    compact_shape = right - left <= 30 and bottom - top <= 30
                # Hardware boxes include a few pixels of surrounding cabinet.
                # Resolve the actual metal silhouette at a deliberately low
                # contrast threshold so handles stay unchanged without leaving
                # an untinted rectangular halo in the wood finish.
                protected_detail = hardware_like or compact_shape
                excluded |= semantic_object_pixels(
                    image,
                    selected,
                    shape,
                    threshold=18 if protected_detail else 40,
                    expand=1,
                )
    return excluded


def source_image(source):
    return Image.open(source).convert("RGB")


def grow_from_core(core, candidate, steps):
    grown = core.copy()
    for _ in range(steps):
        expanded = np.asarray(
            Image.fromarray(np.where(grown, 255, 0).astype(np.uint8), mode="L").filter(
                ImageFilter.MaxFilter(3)
            )
        ) > 0
        grown = core | (candidate & expanded)
    return grown


def warm_material(rgb, hsv, spatial):
    red = rgb[:, :, 0].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    candidate = (
        spatial
        & (hsv[:, :, 0] >= 8)
        & (hsv[:, :, 0] <= 36)
        & (hsv[:, :, 1] >= 52)
        & (hsv[:, :, 2] >= 22)
        & (hsv[:, :, 2] <= 250)
        & ((red - blue) >= 34)
    )
    core = candidate & (hsv[:, :, 1] >= 90) & ((red - blue) >= 65)
    # Pale face frames and reflected edges can be several dozen pixels away
    # from the strongly saturated grain that anchors the material. Grow across
    # the complete local wood surface, while the spatial contract and authored
    # object exclusions keep the propagation out of the room and styling.
    return grow_from_core(core, candidate, 48)


def neutral_material(rgb, hsv, spatial):
    # Radiator cabinetry is pale painted wood, so hue cannot distinguish it
    # from the room. Its authored envelope already traces only the installation
    # (including segmented top slabs around props). Within that footprint,
    # luminance keeps the cabinet faces/slats while rejecting grille and toe
    # voids; saturation preserves brass knobs as hardware rather than paint.
    return (
        spatial
        & (hsv[:, :, 2] >= 96)
        & (hsv[:, :, 2] <= 252)
        & (hsv[:, :, 1] <= 126)
    )


def finish_mask(source, spatial, material):
    image = source_image(source)
    if image.size != spatial.size:
        raise ValueError(f"{source.relative_to(PROJECT_ROOT)} and its spatial mask differ")
    installation = spatial.convert("L")
    installation_pixels = np.asarray(installation) > 0
    excluded = exclusion_mask(source, image, installation_pixels)
    exclusion = Image.fromarray(
        np.where(excluded, 255, 0).astype(np.uint8),
        mode="L",
    )
    # Preserve any authored antialiasing at cabinet boundaries while forcing
    # every protected semantic pixel to zero.
    mask = ImageChops.subtract(installation, exclusion)
    validate_quality_probes(source, mask)
    validate_authored_hardware_regions(source, mask)
    return mask


def validate_quality_probes(source, mask):
    relative = source.relative_to(ASSET_ROOT).as_posix()
    probes = QUALITY_PROBES.get(relative)
    if not probes:
        return
    for label, point in probes["protected"].items():
        value = mask.getpixel(point)
        if value > 8:
            raise ValueError(
                f"{relative} recolors protected {label} at {point}: mask={value}"
            )
    for label, point in probes["wood"].items():
        value = mask.getpixel(point)
        if value < 224:
            raise ValueError(
                f"{relative} misses {label} wood at {point}: mask={value}"
            )


def validate_authored_hardware_regions(source, mask):
    """Fail generation if any authored handle/knob/pull can receive finish."""

    relative = source.relative_to(ASSET_ROOT).as_posix()
    definition = authored_exclusions().get(relative, {})
    for plural, kind in (
        ("rectangles", "rectangle"),
        ("ellipses", "ellipse"),
        ("polygons", "polygon"),
    ):
        for specification in definition.get(plural, ()):
            if not isinstance(specification, dict):
                continue
            label = str(specification.get("label", "")).lower()
            if not any(token in label for token in HARDWARE_LABEL_TOKENS):
                continue
            bounds = shape_mask(mask.size, kind, specification).getbbox()
            if not bounds:
                raise ValueError(f"{relative} has empty authored {label}")
            left, top, right, bottom = bounds
            width = right - left
            height = bottom - top
            if width >= height:
                probes = (
                    (left + width // 4, top + height // 2),
                    (left + width // 2, top + height // 2),
                    (left + (3 * width) // 4, top + height // 2),
                )
            else:
                probes = (
                    (left + width // 2, top + height // 4),
                    (left + width // 2, top + height // 2),
                    (left + width // 2, top + (3 * height) // 4),
                )
            values = [mask.getpixel(point) for point in probes]
            if max(values) > 8:
                raise ValueError(
                    f"{relative} recolors authored {label} at {probes}: {values}"
                )


def integrated_targets():
    for category_id, family in FAMILIES.items():
        style_id = family["style"]
        directory = ASSET_ROOT / "integrated" / category_id / style_id
        for layout_id in LAYOUTS:
            if layout_id in family["native"]:
                continue
            source_version = family["source_versions"].get(layout_id, 1)
            source = directory / f"{layout_id}-v{source_version}.png"
            spatial = Image.open(installation_matte_path(source)).convert("L")
            yield source, spatial, family["material"]


def generic_targets():
    for name, definition in GENERIC_GEOMETRY.items():
        source = ASSET_ROOT / name
        spatial = Image.open(installation_matte_path(source)).convert("L")
        yield source, spatial, definition["material"]


def images_match(expected, path):
    if not path.exists():
        return False
    actual = Image.open(path)
    return (
        actual.mode == expected.mode
        and actual.size == expected.size
        and ImageChops.difference(actual, expected).getbbox() is None
    )


def main():
    parser = ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify committed v3 mattes without rewriting them",
    )
    args = parser.parse_args()
    integrated = list(integrated_targets())
    generic = list(generic_targets())
    missing_installation_mattes = [
        installation_matte_path(source)
        for source, _, _ in (*integrated, *generic)
        if not installation_matte_path(source).exists()
    ]
    if missing_installation_mattes:
        paths = "\n".join(
            str(path.relative_to(PROJECT_ROOT)) for path in missing_installation_mattes
        )
        raise SystemExit(f"Missing authored installation mattes:\n{paths}")
    expected_envelopes = {
        source.relative_to(ASSET_ROOT).as_posix() for source, _, _ in integrated
    }
    actual_envelopes = set(authored_envelopes())
    if actual_envelopes != expected_envelopes:
        raise SystemExit(
            "Finish-mask envelope coverage mismatch: "
            f"missing={sorted(expected_envelopes - actual_envelopes)}, "
            f"extra={sorted(actual_envelopes - expected_envelopes)}"
        )
    expected_exclusions = {
        source.relative_to(ASSET_ROOT).as_posix()
        for source, _, material in integrated
        if material == "warm"
    }
    expected_exclusions.update(
        source.relative_to(ASSET_ROOT).as_posix() for source, _, _ in generic
    )
    actual_exclusions = set(authored_exclusions())
    if actual_exclusions != expected_exclusions:
        raise SystemExit(
            "Finish-mask exclusion coverage mismatch: "
            f"missing={sorted(expected_exclusions - actual_exclusions)}, "
            f"extra={sorted(actual_exclusions - expected_exclusions)}"
        )
    missing_object_mattes = [
        object_exclusion_path(source)
        for source, _, material in (*integrated, *generic)
        if material == "warm" and not object_exclusion_path(source).exists()
    ]
    if missing_object_mattes:
        paths = "\n".join(
            str(path.relative_to(PROJECT_ROOT)) for path in missing_object_mattes
        )
        raise SystemExit(f"Missing authored finish object mattes:\n{paths}")
    stale = []
    count = 0
    for source, spatial, material in (*integrated, *generic):
        target = output_path(source)
        mask = finish_mask(source, spatial, material)
        if args.check:
            if not images_match(mask, target):
                stale.append(target)
        else:
            mask.save(target, optimize=True)
        count += 1
        print(f"{target.relative_to(PROJECT_ROOT)} ({material})")
    if count != 43:
        raise SystemExit(f"Expected 43 non-bookcase preview sources, found {count}")
    if stale:
        paths = "\n".join(str(path.relative_to(PROJECT_ROOT)) for path in stale)
        raise SystemExit(f"Wood-only finish mattes are stale:\n{paths}")


if __name__ == "__main__":
    main()
