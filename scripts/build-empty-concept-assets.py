"""Build cache-safe empty-cabinetry previews from reviewed ImageGen fills.

ImageGen candidates are deliberately never published as complete frames.  For
bookcases, a reviewed candidate supplies the exact authored installation
footprint so every newly empty shelf keeps coherent material and lighting; for
the other products it supplies only bounded styling and cast-shadow areas.  A
silhouette-only inpaint leaves the original object's shadows behind and creates
dark ghosts on otherwise empty shelves.  The room, camera, crop, and
architecture remain byte-for-byte unchanged everywhere outside those committed
mattes.

The script is primarily a production builder.  Its companion ``--check`` mode
verifies that a published empty preview still has the exact source dimensions
and that every pixel outside the committed removal matte is unchanged.
"""

from __future__ import annotations

from argparse import ArgumentParser
from collections import deque
from dataclasses import dataclass
import json
from pathlib import Path
import re

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = PROJECT_ROOT / "assets/photos/configurator"
CANDIDATE_ROOT = PROJECT_ROOT / "artifacts/empty-shelf-concepts/candidates"
REMOVAL_MASK_VERSION = 1
FINISH_MASK_VERSION = 4
FINISH_ENVELOPE_MANIFESTS = (
    PROJECT_ROOT / "scripts/finish-mask-envelopes-tv-window.json",
    PROJECT_ROOT / "scripts/finish-mask-envelopes-floating.json",
    PROJECT_ROOT / "scripts/finish-mask-envelopes-radiator.json",
    PROJECT_ROOT / "scripts/finish-mask-envelopes-bookcase.json",
)
_FINISH_ENVELOPES: dict[str, dict] | None = None
FIXED_EXCLUSION_MANIFESTS = (
    PROJECT_ROOT / "scripts/finish-mask-exclusions-tv-generic.json",
    PROJECT_ROOT / "scripts/finish-mask-exclusions-floating-window.json",
)
_FIXED_EXCLUSIONS: dict[str, dict] | None = None
FIXED_LABEL_TOKENS = (
    "hardware",
    "handle",
    "knob",
    "pull",
    "cushion",
    "fabric",
    "television",
    "screen",
    "soundbar",
    "media bar",
    "emitter",
    "led",
    "light strip",
    "spotlight",
    "recessed light",
    "firebox",
    "fireplace opening",
    "grille gap",
    "vent gap",
    "spill",
)


# Some staged objects sit above the authored furniture installation/exclusion
# mattes (most notably foliage above radiator covers).  These reviewed,
# source-specific zones include the object and its cast shadow, while keeping
# the rest of the generated frame out of production.  Coordinates are authored
# against the original source dimensions and scale if a source is regenerated
# at another resolution.
STAGING_ZONES_1536: dict[str, tuple[tuple[int, int, int, int], ...]] = {
    "assets/photos/configurator/product-floating-storage-v1.png": (
        (150, 80, 630, 520),
        (1240, 370, 1390, 550),
    ),
    "assets/photos/configurator/concept-tv-wall-v1.png": (
        (280, 470, 470, 710),
    ),
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/corner-wall-v1.png": (
        (575, 190, 820, 330),
    ),
    "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/corner-wall-v1.png": (
        (370, 180, 590, 310),
        (340, 545, 590, 690),
    ),
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/niche-layout-v1.png": (
        (1030, 510, 1220, 640),
    ),
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/fireplace-wall-v1.png": (
        (1220, 170, 1460, 340),
    ),
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/door-wall-v1.png": (
        (1300, 380, 1480, 570),
        (980, 570, 1170, 710),
    ),
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/corner-wall-v1.png": (
        (370, 190, 840, 370),
        (950, 240, 1140, 430),
        (820, 430, 970, 560),
    ),
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/niche-layout-v1.png": (
        (200, 100, 680, 610),
        (1240, 330, 1420, 550),
    ),
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/left-niche-v1.png": (
        (220, 140, 650, 560),
        (1230, 400, 1400, 590),
    ),
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/right-niche-v1.png": (
        (100, 30, 460, 410),
        (970, 210, 1370, 610),
    ),
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/fireplace-wall-v1.png": (
        (40, 250, 450, 590),
        (400, 520, 620, 650),
        (1320, 530, 1440, 640),
        (1430, 390, 1536, 570),
    ),
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/center-recess-v1.png": (
        (20, 200, 460, 620),
        (1350, 430, 1500, 600),
    ),
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/window-wall-v1.png": (
        (60, 220, 480, 690),
        (810, 540, 960, 690),
    ),
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/door-wall-v1.png": (
        (30, 140, 620, 650),
        (1340, 400, 1510, 590),
    ),
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/corner-wall-v1.png": (
        (20, 100, 530, 550),
        (1310, 390, 1470, 570),
    ),
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/niche-layout-v1.png": (
        (360, 690, 520, 840),
    ),
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/left-niche-v1.png": (
        (450, 540, 950, 750),
    ),
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/right-niche-v1.png": (
        (320, 500, 720, 760),
        (910, 540, 1150, 720),
    ),
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/clear-wall-v2.png": (
        (1020, 570, 1220, 720),
    ),
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/fireplace-wall-v1.png": (
        (420, 670, 600, 800),
    ),
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/center-recess-v1.png": (
        (1260, 270, 1380, 410),
    ),
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/door-wall-v1.png": (
        (1260, 180, 1430, 310),
        (490, 480, 590, 600),
    ),
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/corner-wall-v1.png": (
        (290, 520, 760, 900),
        (100, 650, 330, 820),
        (1320, 650, 1490, 820),
    ),
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/double-opening-v2.png": (
        (490, 520, 1030, 760),
    ),
    "assets/photos/configurator/product-radiator-cover-v1.png": (
        (35, 10, 510, 450),
        (1160, 250, 1425, 430),
    ),
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/center-recess-v1.png": (
        (115, 245, 410, 615),
        (1135, 440, 1360, 615),
    ),
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/clear-wall-v1.png": (
        (170, 70, 455, 510),
        (1210, 290, 1420, 495),
    ),
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/corner-wall-v1.png": (
        (0, 115, 455, 630),
        (1150, 245, 1536, 640),
    ),
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/door-wall-v1.png": (
        (125, 245, 445, 600),
        (920, 205, 1520, 605),
    ),
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/fireplace-wall-v1.png": (
        (0, 175, 520, 625),
        (1050, 410, 1525, 610),
    ),
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/left-niche-v1.png": (
        (1015, 195, 1510, 610),
    ),
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/niche-layout-v1.png": (
        (240, 225, 660, 610),
        (875, 420, 1175, 610),
    ),
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/right-niche-v1.png": (
        (40, 240, 525, 630),
        (575, 425, 850, 610),
    ),
}


STAGING_ZONES_NATIVE: dict[str, tuple[tuple[int, int, int, int], ...]] = {
    # This vase is on the cabinetry's window ledge but outside the historical
    # finish-exclusion matte.  The cabinet-window candidate reconstructs the
    # sill and view cleanly inside this single bounded zone.
    "assets/photos/configurator/concept-window-cabinets-v1.png": (
        (430, 440, 760, 790),
    ),
}


@dataclass(frozen=True)
class Component:
    pixels: tuple[np.ndarray, np.ndarray]
    bounds: tuple[int, int, int, int]
    area: int


def authored_path(source: Path, suffix: str) -> Path:
    if "clear-wall-furniture" in source.name:
        name = re.sub(r"clear-wall-furniture-v\d+\.png$", f"clear-wall-{suffix}.png", source.name)
    else:
        name = re.sub(r"-v\d+\.png$", f"-{suffix}.png", source.name)
    return source.with_name(name)


def next_version_path(source: Path) -> Path:
    match = re.search(r"-v(\d+)\.png$", source.name)
    if not match:
        raise ValueError(f"Versioned PNG required: {source}")
    version = int(match.group(1)) + 1
    return source.with_name(re.sub(r"-v\d+\.png$", f"-v{version}.png", source.name))


def source_exclusion_path(source: Path) -> Path:
    return authored_path(source, "finish-exclusions-v1")


def source_installation_path(source: Path) -> Path:
    return authored_path(source, "finish-installation-v1")


def removal_mask_path(output: Path) -> Path:
    return authored_path(output, f"empty-removal-mask-v{REMOVAL_MASK_VERSION}")


def finish_mask_path(output: Path) -> Path:
    return authored_path(output, f"finish-mask-v{FINISH_MASK_VERSION}")


def connected_components(mask: np.ndarray) -> list[Component]:
    """Return 8-connected components without adding a SciPy dependency."""

    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[Component] = []
    for start_y, start_x in zip(*np.where(mask & ~visited)):
        if visited[start_y, start_x]:
            continue
        queue = deque(((int(start_y), int(start_x)),))
        visited[start_y, start_x] = True
        ys: list[int] = []
        xs: list[int] = []
        while queue:
            y, x = queue.popleft()
            ys.append(y)
            xs.append(x)
            for delta_y in (-1, 0, 1):
                for delta_x in (-1, 0, 1):
                    if not delta_x and not delta_y:
                        continue
                    neighbor_y = y + delta_y
                    neighbor_x = x + delta_x
                    if not (0 <= neighbor_y < height and 0 <= neighbor_x < width):
                        continue
                    if visited[neighbor_y, neighbor_x] or not mask[neighbor_y, neighbor_x]:
                        continue
                    visited[neighbor_y, neighbor_x] = True
                    queue.append((neighbor_y, neighbor_x))
        y_values = np.asarray(ys, dtype=np.int32)
        x_values = np.asarray(xs, dtype=np.int32)
        components.append(
            Component(
                pixels=(y_values, x_values),
                bounds=(
                    int(x_values.min()),
                    int(y_values.min()),
                    int(x_values.max()) + 1,
                    int(y_values.max()) + 1,
                ),
                area=len(ys),
            )
        )
    return components


def is_fixed_line(component: Component) -> bool:
    left, top, right, bottom = component.bounds
    width = right - left
    height = bottom - top
    return width >= 48 and height <= 20 and width >= height * 8


def shape_mask(
    size: tuple[int, int],
    kind: str,
    specification: dict | list,
) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    if kind == "rectangle":
        values = specification.get("xywh", specification) if isinstance(specification, dict) else specification
        left, top, width, height = values
        draw.rectangle((left, top, left + width - 1, top + height - 1), fill=255)
    elif kind == "ellipse":
        values = specification.get("bounds", specification) if isinstance(specification, dict) else specification
        draw.ellipse(tuple(values), fill=255)
    else:
        values = specification.get("points", specification) if isinstance(specification, dict) else specification
        draw.polygon(tuple(tuple(point) for point in values), fill=255)
    return mask


def authored_fixed_exclusion(source: Path, exclusion: Image.Image) -> Image.Image:
    """Return only permanent non-wood details from the authored exclusions.

    The legacy exclusion matte intentionally combined removable styling with
    screens, LEDs, upholstery, hardware, and known room spill.  Empty previews
    must restore wood behind the first group while continuing to protect the
    second group.  The source manifests retain those semantic labels, so use
    them to split the shared bitmap instead of guessing from color alone.
    """

    global _FIXED_EXCLUSIONS
    if _FIXED_EXCLUSIONS is None:
        _FIXED_EXCLUSIONS = {}
        for path in FIXED_EXCLUSION_MANIFESTS:
            _FIXED_EXCLUSIONS.update(json.loads(path.read_text())["entries"])
    relative = source.relative_to(ASSET_ROOT).as_posix()
    definition = _FIXED_EXCLUSIONS.get(relative, {})
    is_window_storage = "/window-storage/window-seat-storage/" in relative
    fixed = Image.new("L", exclusion.size, 0)
    for plural, kind in (
        ("rectangles", "rectangle"),
        ("ellipses", "ellipse"),
        ("polygons", "polygon"),
    ):
        for specification in definition.get(plural, ()):
            if not isinstance(specification, dict):
                continue
            label = str(specification.get("label", "")).lower()
            # Window Storage's generated manifest predates semantic fixture
            # labels. Its repeated compact ellipse and lower-cabinet rectangle
            # regions were authored around recessed spotlights and pulls.
            # They are search regions only: the intersection with `exclusion`
            # below retains the exact non-wood silhouette, not the full shape.
            window_fixture_region = False
            window_handle_region = False
            if is_window_storage and kind == "ellipse":
                left, top, right, bottom = specification["bounds"]
                window_fixture_region = right - left <= 50 and bottom - top <= 30
            elif is_window_storage and kind == "rectangle":
                left, top, width, height = specification["xywh"]
                window_handle_region = (
                    top >= exclusion.height * 0.67
                    and (
                        (width <= 100 and height <= 35)
                        or (width <= 50 and height <= 85)
                    )
                )
                window_fixture_region = window_handle_region
            if window_handle_region:
                # A few legacy pull regions also contain a disconnected piece
                # of removed styling. Keep only elongated horizontal/vertical
                # hardware components so candidate wood behind that styling
                # remains finishable.
                search = ImageChops.multiply(
                    shape_mask(exclusion.size, kind, specification),
                    exclusion,
                )
                retained = np.zeros(
                    (exclusion.height, exclusion.width),
                    dtype=bool,
                )
                for component in connected_components(np.asarray(search) >= 32):
                    component_left, component_top, component_right, component_bottom = component.bounds
                    component_width = component_right - component_left
                    component_height = component_bottom - component_top
                    horizontal_pull = (
                        component_width >= 14
                        and component_height <= 20
                        and component_width >= component_height * 2.2
                    )
                    vertical_pull = (
                        component_height >= 14
                        and component_width <= 20
                        and component_height >= component_width * 2.2
                    )
                    if horizontal_pull or vertical_pull:
                        retained[component.pixels] = True
                fixed = ImageChops.lighter(
                    fixed,
                    Image.fromarray(
                        np.where(retained, 255, 0).astype(np.uint8),
                        mode="L",
                    ),
                )
                continue
            removed_fabric_throw = is_window_storage and "fabric throw" in label
            fixed_label = (
                not removed_fabric_throw
                and any(token in label for token in FIXED_LABEL_TOKENS)
            )
            if fixed_label or window_fixture_region:
                fixed = ImageChops.lighter(
                    fixed,
                    shape_mask(exclusion.size, kind, specification),
                )
    # Authored shapes are search regions for some fine details.  Intersecting
    # them with the reviewed source exclusion retains the exact silhouettes.
    return ImageChops.multiply(fixed, exclusion)


def fixed_horizontal_lines(exclusion: Image.Image) -> Image.Image:
    """Extract thin authored LED/shelf-light runs, even when props touch them."""

    pixels = np.asarray(exclusion.convert("L")) >= 32
    candidates = np.zeros_like(pixels)
    for y, row in enumerate(pixels):
        padded = np.pad(row.astype(np.int8), (1, 1))
        transitions = np.diff(padded)
        starts = np.flatnonzero(transitions == 1)
        stops = np.flatnonzero(transitions == -1)
        for start, stop in zip(starts, stops):
            if stop - start >= 144:
                candidates[y, start:stop] = True
    retained = np.zeros_like(candidates)
    for component in connected_components(candidates):
        left, top, right, bottom = component.bounds
        if bottom - top <= 12 and right - left >= 144:
            retained[component.pixels] = True
    line = Image.fromarray(np.where(retained, 255, 0).astype(np.uint8), mode="L")
    return ImageChops.multiply(line.filter(ImageFilter.MaxFilter(3)), exclusion)


def fixed_light_emitters(
    candidate: Image.Image,
    exclusion: Image.Image,
    max_y: int | None = None,
) -> Image.Image:
    """Keep only the luminous core of authored shelf-light exclusions.

    The historical exclusion mattes often joined a light strip to books,
    plants, and their cast shadows.  Reusing those complete components leaves
    conspicuous unpainted scars across a newly empty painted shelf.  Here the
    authored matte is only a search region: a pixel is retained when the empty
    candidate confirms that it is a bright, warm, horizontally continuous
    emitter with local vertical contrast.  The surrounding illuminated wood
    remains finishable, while the non-wood LED itself keeps its natural light.
    """

    line_region = np.asarray(fixed_horizontal_lines(exclusion).convert("L")) >= 32
    if max_y is not None:
        line_region[max_y:] = False
    rgb = np.asarray(candidate.convert("RGB"), dtype=np.float32)
    luminance = rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722
    above = np.empty_like(luminance)
    below = np.empty_like(luminance)
    above[:6] = luminance[:1]
    above[6:] = luminance[:-6]
    below[-6:] = luminance[-1:]
    below[:-6] = luminance[6:]
    local_vertical = luminance - ((above + below) / 2)
    warm_bright = (
        (luminance >= 145)
        & (rgb[:, :, 0] >= 165)
        & (rgb[:, :, 1] >= 115)
        & (rgb[:, :, 0] >= rgb[:, :, 2] * 1.08)
        & (local_vertical >= 13)
    )
    seeds = line_region & warm_bright
    retained = np.zeros_like(seeds)
    for y, authored_row in enumerate(line_region):
        padded = np.pad(authored_row.astype(np.int8), (1, 1))
        transitions = np.diff(padded)
        starts = np.flatnonzero(transitions == 1)
        stops = np.flatnonzero(transitions == -1)
        for start, stop in zip(starts, stops):
            row_seeds = np.flatnonzero(seeds[y, start:stop]) + start
            if len(row_seeds) < 24 or row_seeds[-1] - row_seeds[0] < 56:
                continue
            # Wood grain can interrupt the threshold for a few pixels.  Once
            # one authored horizontal run is confirmed as a light, bridge only
            # between its first and last luminous samples for a clean core.
            retained[y, row_seeds[0]:row_seeds[-1] + 1] = True
    emitter = Image.fromarray(np.where(retained, 255, 0).astype(np.uint8), mode="L")
    return ImageChops.multiply(emitter.filter(ImageFilter.MaxFilter(3)), exclusion)


def fixed_bookcase_light_strips(
    candidate: Image.Image,
    max_y_ratio: float = 0.76,
) -> Image.Image:
    """Recover complete warm shelf-light cores from the approved empty image.

    The legacy exclusion mattes were drawn around staged books and decor, so
    their LED fragments stop wherever a prop interrupted the original shelf.
    The reviewed empty candidate contains the final, continuous emitters.  Use
    its warm high-contrast linework to recover one narrow lower trace per shelf
    instead of stretching the prop-era fragments across the cabinetry.
    """

    rgb = np.asarray(candidate.convert("RGB"), dtype=np.float32)
    height, width, _ = rgb.shape
    luminance = rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722
    above = np.empty_like(luminance)
    below = np.empty_like(luminance)
    above[:6] = luminance[:1]
    above[6:] = luminance[:-6]
    below[-6:] = luminance[-1:]
    below[:-6] = luminance[6:]
    local_vertical = luminance - ((above + below) / 2)

    below_rows = np.minimum(np.arange(height) + 20, height - 1)
    below_rgb = rgb[below_rows]
    warm_wood_below = (
        (below_rgb[:, :, 0] - below_rgb[:, :, 2] >= 45)
        & (below_rgb[:, :, 0] - below_rgb[:, :, 1] >= 20)
    )
    seeds = (
        (luminance >= 145)
        & (rgb[:, :, 0] >= 165)
        & (rgb[:, :, 1] >= 115)
        & (rgb[:, :, 0] >= rgb[:, :, 2] * 1.08)
        & (local_vertical >= 13)
        & warm_wood_below
    )
    # Crown highlights and floorboards can satisfy the same color threshold,
    # but every authored Bookcase emitter sits inside this vertical band.
    seeds[:round(height * 0.12)] = False
    seeds[round(height * max_y_ratio):] = False

    grouped = np.asarray(
        Image.fromarray(np.where(seeds, 255, 0).astype(np.uint8), mode="L").filter(
            ImageFilter.MaxFilter(7)
        )
    ) >= 32
    traces: list[dict] = []
    for component in connected_components(grouped):
        left, top, right, bottom = component.bounds
        component_width = right - left
        component_height = bottom - top
        seed_selector = seeds[component.pixels]
        seed_count = int(seed_selector.sum())
        if (
            component_width < max(56, round(width * 0.035))
            or component_height > round(height * 0.10)
            or component_width < component_height * 1.8
            or seed_count < 30
        ):
            continue
        seed_y = component.pixels[0][seed_selector]
        seed_x = component.pixels[1][seed_selector]
        traces.append({
            "left": left,
            "right": right,
            "center_y": float(seed_y.mean()),
            "x": seed_x,
            "y": seed_y,
        })

    # Shelf-front highlights sit just above, and overlap, the actual emitter.
    # Collapse each overlapping pair to its lower trace.  Perspective can make
    # those traces cross at one end, so cluster on absolute vertical distance
    # rather than relying on a strict upper/lower ordering at every x value.
    duplicate_groups: list[list[dict]] = []
    for trace in traces:
        matching_group = None
        for group in duplicate_groups:
            if any(
                abs(trace["center_y"] - member["center_y"]) <= 46
                and max(
                    0,
                    min(trace["right"], member["right"])
                    - max(trace["left"], member["left"]),
                )
                >= min(
                    trace["right"] - trace["left"],
                    member["right"] - member["left"],
                ) * 0.62
                for member in group
            ):
                matching_group = group
                break
        if matching_group is None:
            matching_group = []
            duplicate_groups.append(matching_group)
        matching_group.append(trace)

    retained_traces: list[dict] = []
    for group in duplicate_groups:
        trace = max(
            group,
            key=lambda value: (
                value["center_y"],
                value["right"] - value["left"],
            ),
        ).copy()
        trace["left"] = min(value["left"] for value in group)
        trace["right"] = max(value["right"] for value in group)
        retained_traces.append(trace)

    trace_groups: list[list[dict]] = []
    for trace in sorted(
        retained_traces,
        key=lambda value: (value["left"] + value["right"]) / 2,
    ):
        matching_group = None
        for group in trace_groups:
            if any(
                max(
                    0,
                    min(trace["right"], member["right"])
                    - max(trace["left"], member["left"]),
                )
                >= min(
                    trace["right"] - trace["left"],
                    member["right"] - member["left"],
                ) * 0.55
                for member in group
            ):
                matching_group = group
                break
        if matching_group is None:
            matching_group = []
            trace_groups.append(matching_group)
        matching_group.append(trace)

    for group in trace_groups:
        group_left = round(np.median([trace["left"] for trace in group])) + 3
        group_right = round(np.median([trace["right"] for trace in group])) - 4
        for trace in group:
            trace["group_left"] = group_left
            trace["group_right"] = group_right

    emitter = Image.new("L", candidate.size, 0)
    draw = ImageDraw.Draw(emitter)
    for trace in retained_traces:
        x_values = trace["x"]
        y_values = trace["y"]
        unique_x = np.unique(x_values)
        lower_y = np.asarray([
            np.percentile(y_values[x_values == x], 82)
            for x in unique_x
        ])
        if len(unique_x) < 12:
            continue
        slope, intercept = np.polyfit(unique_x, lower_y, 1)
        residual = lower_y - (unique_x * slope + intercept)
        median_residual = np.median(residual)
        inliers = np.abs(residual - median_residual) <= 8
        if int(inliers.sum()) >= 12:
            slope, intercept = np.polyfit(unique_x[inliers], lower_y[inliers], 1)
        left = int(trace["group_left"])
        right = int(trace["group_right"])
        draw.line(
            (
                (left, round(left * slope + intercept)),
                (right, round(right * slope + intercept)),
            ),
            fill=255,
            width=5,
        )
    return emitter


def authored_bookcase_light_strips(source: Path, size: tuple[int, int]) -> Image.Image:
    """Render deterministic perspective LED segments from the envelope manifest."""

    definition = finish_envelope_definition(source) or {}
    emitter = Image.new("L", size, 0)
    draw = ImageDraw.Draw(emitter)
    for specification in definition.get("fixedLightLines", ()):
        x1, y1, x2, y2, line_width = specification
        draw.line(((x1, y1), (x2, y2)), fill=255, width=line_width)
    return emitter


def fixed_bookcase_hardware(candidate: Image.Image, exclusion: Image.Image) -> Image.Image:
    """Recover dark lower-cabinet knobs missed by legacy exclusion mattes.

    Several authored Bookcase mattes trace only one knob in a paired-door set.
    Search immediately around those reviewed lower-cabinet exclusions in the
    empty candidate, retain only compact very-dark components, and expand the
    core just enough to cover its antialiased metal rim.  Long door seams and
    wood grain cannot satisfy the compact filled-component contract.
    """

    rgb = np.asarray(candidate.convert("RGB"), dtype=np.float32)
    luminance = rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722
    search = np.asarray(exclusion.filter(ImageFilter.MaxFilter(65)).convert("L")) >= 32
    search[:round(candidate.height * 0.56)] = False
    dark = (luminance < 60) & search
    compact: list[Component] = []
    for component in connected_components(dark):
        left, top, right, bottom = component.bounds
        width = right - left
        height = bottom - top
        if not (7 <= width <= 28 and 7 <= height <= 28 and component.area >= 45):
            continue
        if component.area / (width * height) < 0.24:
            continue
        compact.append(component)
    retained = np.zeros_like(dark)
    for component in compact:
        _, top, _, bottom = component.bounds
        center_y = (top + bottom) / 2
        # Hardware repeats across a door/drawer row.  A lone compact dark
        # remnant on an open shelf is decoration, not hardware.
        row_peers = sum(
            abs((((peer.bounds[1] + peer.bounds[3]) / 2) - center_y)) <= 16
            for peer in compact
        )
        if row_peers >= 2:
            retained[component.pixels] = True
    hardware = Image.fromarray(np.where(retained, 255, 0).astype(np.uint8), mode="L")
    return hardware.filter(ImageFilter.MaxFilter(9))


def binary_box_sum(pixels: np.ndarray, radius: int, pad_value: int) -> np.ndarray:
    """Return square-window sums in O(width * height) via an integral image."""

    kernel = radius * 2 + 1
    padded = np.pad(
        pixels.astype(np.uint8),
        ((radius, radius), (radius, radius)),
        constant_values=pad_value,
    )
    integral = np.pad(
        padded.cumsum(axis=0, dtype=np.uint32).cumsum(axis=1, dtype=np.uint32),
        ((1, 0), (1, 0)),
    )
    return (
        integral[kernel:, kernel:]
        - integral[:-kernel, kernel:]
        - integral[kernel:, :-kernel]
        + integral[:-kernel, :-kernel]
    )


def binary_close(mask: Image.Image, radius: int) -> Image.Image:
    """Close internal holes without moving the outside silhouette boundary."""

    pixels = np.asarray(mask.convert("L")) >= 32
    dilated = binary_box_sum(pixels, radius, 0) > 0
    area = (radius * 2 + 1) ** 2
    closed = binary_box_sum(dilated, radius, 0) == area
    return Image.fromarray(np.where(closed, 255, 0).astype(np.uint8), mode="L")


def component_difference(
    component: Component,
    difference: np.ndarray,
) -> tuple[float, float, float]:
    values = difference[component.pixels]
    return (
        float(np.median(values)),
        float(np.mean(values)),
        float(np.percentile(values, 90)),
    )


def reviewed_component_selection(
    source: Path,
    original: Image.Image,
    candidate: Image.Image,
    exclusion: Image.Image,
) -> tuple[Image.Image, Image.Image]:
    """Split the staged-source exclusion into removable and fixed content.

    The authored exclusion already traces semantic foreground silhouettes.
    A component is removable when the empty candidate differs materially in
    that silhouette.  Long, thin components are fixed LED emitters/shelf-light
    lines.  Large central TV/screen components are also fixed.  Low-difference
    components remain fixed by default, which fails safely instead of altering
    hardware or architecture.
    """

    # int32 avoids overflow when squaring a full 8-bit channel delta.
    original_rgb = np.asarray(original.convert("RGB"), dtype=np.int32)
    candidate_rgb = np.asarray(candidate.convert("RGB"), dtype=np.int32)
    difference = np.sqrt(np.sum((original_rgb - candidate_rgb) ** 2, axis=2))
    exclusion_pixels = np.asarray(exclusion.convert("L")) >= 32
    removable = np.zeros_like(exclusion_pixels)
    authored_fixed = authored_fixed_exclusion(source, exclusion)
    relative = source.relative_to(ASSET_ROOT).as_posix()
    has_semantic_labels = relative in (_FIXED_EXCLUSIONS or {})
    is_integrated_bookcase = "/integrated/bookcase/" in source.as_posix()
    is_full_open = (
        "full-open-shelving" in source.as_posix()
        or source.name.startswith("concept-full-shelving-")
    )
    is_cabinet_base = "cabinet-base-shelves" in source.as_posix()
    is_floating_storage = "/floating-storage/" in source.as_posix()
    is_bookcase_concept = source.name.startswith((
        "concept-cabinets-shelves-",
        "concept-drawers-shelves-",
        "concept-full-shelving-",
        "concept-tv-wall-",
        "concept-window-cabinets-",
    ))
    # The legacy Bookcase exclusion mattes merged shelf lighting, styling, and
    # styling shadows into the same irregular horizontal bands.  Preserve only
    # the candidate-confirmed luminous emitter core; the illuminated wood and
    # former styling footprint receive one continuous finish.
    # Prop-era exclusion mattes contain only intermittent pieces of the shelf
    # lights.  The approved empty candidate below is the authoritative source
    # for Bookcase emitter continuity.
    line_fixed = Image.new("L", exclusion.size, 0)
    authored_light_fixed = authored_bookcase_light_strips(source, exclusion.size)
    has_authored_bookcase_lights = authored_light_fixed.getbbox() is not None
    continuous_light_fixed = (
        authored_light_fixed
        if has_authored_bookcase_lights
        else (
            fixed_bookcase_light_strips(
                candidate,
                0.76
                if is_full_open or source.name.startswith("concept-full-shelving-")
                else 0.56,
            )
            if is_integrated_bookcase or is_bookcase_concept
            else Image.new("L", exclusion.size, 0)
        )
    )
    hardware_fixed = (
        fixed_bookcase_hardware(candidate, exclusion)
        if is_integrated_bookcase and not is_full_open
        else Image.new("L", exclusion.size, 0)
    )
    fixed_seed = ImageChops.lighter(
        ImageChops.lighter(
            ImageChops.lighter(authored_fixed, line_fixed),
            continuous_light_fixed,
        ),
        hardware_fixed,
    )
    fixed = (np.asarray(fixed_seed) >= 32).copy()
    selectable_pixels = exclusion_pixels & ~fixed
    image_width, image_height = original.size
    is_tv = "tv-unit" in source.as_posix() or source.name.startswith("concept-tv-wall-")

    for component in connected_components(selectable_pixels):
        if component.area < 6:
            continue
        left, top, right, bottom = component.bounds
        width = right - left
        height = bottom - top
        median, mean, percentile_90 = component_difference(component, difference)
        center_x = (left + right) / 2
        central_large_feature = (
            component.area >= image_width * image_height * 0.035
            and width >= image_width * 0.25
            and image_width * 0.32 <= center_x <= image_width * 0.68
        )
        fixed_media_bar = (
            is_tv
            and width >= 100
            and height <= 70
            and left < image_width * 0.6
            and right > image_width * 0.4
            and top > image_height * 0.48
        )
        compact_hardware = (
            width >= 4
            and height >= 4
            and width <= 42
            and height <= 42
            and max(width, height) / min(width, height) <= 3.5
            and component.area >= 12
        )
        floating_horizontal_pull = (
            is_floating_storage
            and 24 <= width <= 70
            and 4 <= height <= 18
            and width >= height * 2.5
            and component.area >= 40
        )
        fixed_hardware = (
            not is_full_open
            and (compact_hardware or floating_horizontal_pull)
            # Floating-storage knobs begin just above the 62% line.  Keep the
            # lower-unit hardware band broad enough to retain those exact
            # silhouettes while remaining below every staged shelf object.
            and top > image_height * 0.57
            # Cabinet knobs sit above the plinth.  Tiny dark knots at the
            # bottom of the corner installation are wood, not hardware.
            and (not is_cabinet_base or top < image_height * 0.68)
            and median < 25
            and mean < 40
        )
        fixed_detail = (
            fixed_hardware
            if is_integrated_bookcase
            else (
                is_fixed_line(component)
                or central_large_feature
                or fixed_media_bar
                or fixed_hardware
            )
        )
        changed_semantic_object = (
            median >= 8
            or (mean >= 14 and percentile_90 >= 28)
        )
        # Manifest-backed previews classify permanent content by name, so all
        # remaining exclusions are styling.  Legacy integrated Bookcase masks
        # have no labels; a deliberately sensitive source/candidate delta
        # separates removed styling from unchanged wall/floor spill.
        selected = not fixed_detail and (
            is_integrated_bookcase
            or has_semantic_labels
            # Authored light geometry is the complete fixed-detail contract for
            # these generic Bookcase concepts.  Any remaining non-hardware,
            # non-media exclusion is former styling or wood—not another light.
            # This prevents tiny low-difference prop-era specks from escaping
            # the finish as isolated brown holes.
            or (is_bookcase_concept and has_authored_bookcase_lights)
            or changed_semantic_object
        )
        target = removable if selected else fixed
        target[component.pixels] = True

    removable_image = Image.fromarray(np.where(removable, 255, 0).astype(np.uint8), mode="L")
    fixed_image = Image.fromarray(np.where(fixed, 255, 0).astype(np.uint8), mode="L")
    return removable_image, fixed_image


def feathered_removal(mask: Image.Image) -> Image.Image:
    # Styling—especially foliage—casts shadows well outside its visible edge.
    # Expand the authored semantic silhouette, then feather into the untouched
    # cabinetry.  A 40 px source-space radius cleared the retained dark ghosts
    # found during the benchmark pass while keeping fixed geometry unchanged.
    return mask.filter(ImageFilter.MaxFilter(81)).filter(ImageFilter.GaussianBlur(7.0))


def reviewed_staging_zones(source: Path, size: tuple[int, int]) -> Image.Image:
    relative = source.relative_to(PROJECT_ROOT).as_posix()
    zones = STAGING_ZONES_NATIVE.get(relative)
    coordinate_size = size
    if zones is None:
        zones = STAGING_ZONES_1536.get(relative, ())
        coordinate_size = (1536, 1024)
    mask = Image.new("L", size, 0)
    if not zones:
        return mask
    draw = ImageDraw.Draw(mask)
    scale_x = size[0] / coordinate_size[0]
    scale_y = size[1] / coordinate_size[1]
    for left, top, right, bottom in zones:
        draw.rectangle(
            (
                round(left * scale_x),
                round(top * scale_y),
                round(right * scale_x),
                round(bottom * scale_y),
            ),
            fill=255,
        )
    return mask.filter(ImageFilter.GaussianBlur(9.0))


def finish_envelope_definition(source: Path) -> dict | None:
    """Load one explicitly reviewed furniture-envelope definition."""

    global _FINISH_ENVELOPES
    if _FINISH_ENVELOPES is None:
        _FINISH_ENVELOPES = {}
        for path in FINISH_ENVELOPE_MANIFESTS:
            _FINISH_ENVELOPES.update(json.loads(path.read_text())["entries"])
    relative = source.relative_to(ASSET_ROOT).as_posix()
    return _FINISH_ENVELOPES.get(relative)


def authored_finish_envelope(source: Path, installation: Image.Image) -> Image.Image:
    """Return the reviewed furniture-only footprint for material repairs."""

    definition = finish_envelope_definition(source)
    if definition is None:
        # Bookcase installation mattes already trace the millwork silhouette.
        # Morphological closing restores bounded internal prop holes while
        # returning the outer boundary to its original position.  A one-sided
        # dilation used here previously admitted warm wall and floor pixels.
        return binary_close(installation, 80)

    envelope = Image.new("L", installation.size, 0)
    draw = ImageDraw.Draw(envelope)
    drew_shape = False
    for specification in definition.get("rectangles", ()):
        values = specification.get("xywh", specification) if isinstance(specification, dict) else specification
        left, top, width, height = values
        draw.rectangle((left, top, left + width - 1, top + height - 1), fill=255)
        drew_shape = True
    for specification in (
        *definition.get("polygons", ()),
        *definition.get("includePolygons", ()),
    ):
        points = specification.get("points", specification) if isinstance(specification, dict) else specification
        draw.polygon(tuple(tuple(point) for point in points), fill=255)
        drew_shape = True
    if not drew_shape and definition.get("installationBounds"):
        left, top, right, bottom = definition["installationBounds"]
        draw.rectangle((left, top, right, bottom), fill=255)
    return envelope


def authored_finish_adjustment(
    source: Path,
    size: tuple[int, int],
    key: str,
) -> Image.Image:
    """Return an optional, reviewed post-segmentation material correction."""

    definition = finish_envelope_definition(source) or {}
    adjustment = definition.get(key, {})
    mask = Image.new("L", size, 0)
    for plural, kind in (
        ("rectangles", "rectangle"),
        ("ellipses", "ellipse"),
        ("polygons", "polygon"),
    ):
        for specification in adjustment.get(plural, ()):
            mask = ImageChops.lighter(
                mask,
                shape_mask(size, kind, specification),
            )
    return mask


def uses_full_installation_matte(source: Path) -> bool:
    relative = source.relative_to(PROJECT_ROOT).as_posix()
    return (
        "/integrated/bookcase/" in relative
        or source.name.startswith("concept-cabinets-shelves-between-openings-")
        or source.name.startswith("concept-drawers-shelves-between-openings-")
        or source.name.startswith("concept-full-shelving-between-openings-")
        or source.name.startswith("concept-window-cabinets-")
    )


def finish_material_fill(
    source: Path,
    composite: Image.Image,
    installation: Image.Image,
    removal: Image.Image,
    staging_zones: Image.Image,
) -> Image.Image:
    relative = source.relative_to(PROJECT_ROOT).as_posix()
    # The visual compositor may use broad reviewed staging zones to replace a
    # prop and its shadow.  Finish mattes never use those rectangles: material
    # repair starts only from semantic object silhouettes and is clipped again
    # to an independently authored furniture envelope below.
    candidate_fill = ImageChops.lighter(
        removal.filter(ImageFilter.MaxFilter(81)),
        staging_zones,
    )

    if "/radiator-cover/" in relative or source.name.startswith("product-radiator-cover-"):
        # The pale painted radiator cabinetry is intentionally similar to the
        # wall, so color cannot safely identify it.  Its authored installation
        # matte already traces the case.  Bridge only the shallow top-slab rows
        # that were segmented around now-removed styling; never extend upward
        # into the former vase/foliage silhouettes.
        envelope = authored_finish_envelope(source, installation)
        envelope_pixels = np.asarray(envelope.convert("L")) >= 32
        fill_pixels = np.zeros_like(envelope_pixels)
        bounds = envelope.getbbox()
        if bounds:
            _, top, _, bottom = bounds
            for y in range(top, min(top + 40, bottom)):
                row = envelope_pixels[y]
                padded = np.pad(row.astype(np.int8), (1, 1))
                transitions = np.diff(padded)
                starts = np.flatnonzero(transitions == 1)
                stops = np.flatnonzero(transitions == -1)
                for stop, start in zip(stops[:-1], starts[1:]):
                    # Styling gaps on one continuous radiator top are small;
                    # architectural gaps between separate units are not.
                    if start - stop <= 240:
                        fill_pixels[y, stop:start] = True
        return Image.fromarray(np.where(fill_pixels, 255, 0).astype(np.uint8), mode="L")

    # Every other public concept now has an empty, reviewed output and a
    # furniture-only envelope.  Former-object pixels can therefore be restored
    # directly inside that envelope; color classification is both unnecessary
    # and harmful because dark oak shadows failed the old warm-hue threshold,
    # leaving vase and lamp silhouettes in otherwise empty cabinetry.
    material_envelope = authored_finish_envelope(source, installation)
    return ImageChops.multiply(candidate_fill, material_envelope)


def build(source: Path, candidate: Path) -> tuple[Path, Path, Path]:
    output = next_version_path(source)
    exclusion_path = source_exclusion_path(source)
    installation_path = source_installation_path(source)
    if not exclusion_path.exists():
        raise FileNotFoundError(exclusion_path)
    if not installation_path.exists():
        raise FileNotFoundError(installation_path)

    with Image.open(source) as image:
        original = image.copy()
    with Image.open(candidate) as image:
        generated = image.copy()
    if generated.size != original.size:
        raise ValueError(f"Candidate dimensions differ: {candidate} {generated.size} != {original.size}")
    exclusion = Image.open(exclusion_path).convert("L")
    if exclusion.size != original.size:
        raise ValueError(f"Exclusion dimensions differ: {exclusion_path}")

    removal, fixed = reviewed_component_selection(source, original, generated, exclusion)
    installation = Image.open(installation_path).convert("L")
    if installation.size != original.size:
        raise ValueError(f"Installation dimensions differ: {installation_path}")
    styling_and_shadows = feathered_removal(removal)
    staging_zones = reviewed_staging_zones(source, original.size)
    publish_matte = ImageChops.lighter(styling_and_shadows, staging_zones)
    if uses_full_installation_matte(source):
        installation_blend = installation.filter(ImageFilter.GaussianBlur(0.65))
        publish_matte = ImageChops.lighter(publish_matte, installation_blend)
    original_rgba = original.convert("RGBA")
    generated_rgba = generated.convert("RGBA")
    if original.mode == "RGBA":
        # The installed silhouette/canvas is immutable for layered Clear Wall.
        generated_rgba.putalpha(original_rgba.getchannel("A"))
        publish_matte = ImageChops.multiply(publish_matte, original_rgba.getchannel("A"))
    composite = Image.composite(generated_rgba, original_rgba, publish_matte)
    if original.mode != "RGBA":
        composite = composite.convert("RGB")
    output.parent.mkdir(parents=True, exist_ok=True)
    composite.save(output, optimize=True)

    removal_output = removal_mask_path(output)
    publish_matte.save(removal_output, optimize=True)

    # Historical installation mattes intentionally punched holes for books,
    # plants, and decor.  The empty-shelf cohort must paint the newly revealed
    # wood behind those objects, while still subtracting LEDs, screens, and
    # hardware that were classified as fixed.
    material_fill = finish_material_fill(
        source,
        composite,
        installation,
        removal,
        staging_zones,
    )
    material_envelope = authored_finish_envelope(source, installation)
    envelope_definition = finish_envelope_definition(source) or {}
    if envelope_definition.get("materialBase") == "envelope":
        # These scenes have fully backed cabinetry, but their historical
        # installation mattes omitted outer crown/plinth pixels and punched
        # prop-shaped holes.  Their independently reviewed segmented envelope
        # is the complete wood silhouette, so it is the authoritative base.
        finish_base = material_envelope
    else:
        finish_base = ImageChops.multiply(
            ImageChops.lighter(installation, material_fill),
            ImageChops.lighter(material_envelope, material_fill),
        )
    relative = source.relative_to(PROJECT_ROOT).as_posix()
    is_radiator = (
        "/radiator-cover/" in relative
        or source.name.startswith("product-radiator-cover-")
    )
    if not is_radiator:
        # The independent envelope is the final fail-closed boundary.  This
        # also removes historical warm-object classifier spill inside window,
        # TV, and other deliberately non-material openings.
        finish_base = ImageChops.multiply(finish_base, material_envelope)
    finish_includes = authored_finish_adjustment(
        source,
        original.size,
        "finishIncludes",
    )
    finish_excludes = authored_finish_adjustment(
        source,
        original.size,
        "finishExcludes",
    )
    # Includes are reviewed wood-only repairs and remain bounded by the
    # installation envelope. Excludes are permanent voids such as radiator
    # vents whose historical material matte accidentally bridged the opening.
    finish_includes = ImageChops.multiply(finish_includes, material_envelope)
    finish_base = ImageChops.lighter(finish_base, finish_includes)
    finish = ImageChops.subtract(
        finish_base,
        ImageChops.lighter(fixed, finish_excludes),
    )
    finish_output = finish_mask_path(output)
    finish.save(finish_output, optimize=True)
    return output, removal_output, finish_output


def verify(source: Path, output: Path, removal_path: Path) -> None:
    original = Image.open(source).convert("RGBA")
    empty = Image.open(output).convert("RGBA")
    removal = Image.open(removal_path).convert("L")
    finish_path = finish_mask_path(output)
    finish = Image.open(finish_path).convert("L")
    if (
        original.size != empty.size
        or original.size != removal.size
        or original.size != finish.size
    ):
        raise ValueError(f"Dimension contract failed for {output}")
    allowed = np.asarray(removal) > 0
    original_pixels = np.asarray(original)
    empty_pixels = np.asarray(empty)
    if np.any(original_pixels[~allowed] != empty_pixels[~allowed]):
        raise ValueError(f"Pixels outside removal matte changed: {output}")
    # A source that was already empty is still promoted into the atomic,
    # cache-safe cohort.  In that one case identical pixels are intentional.
    if source.suffix == ".png" and Image.open(source).mode == "RGBA":
        if not np.array_equal(original_pixels[:, :, 3], empty_pixels[:, :, 3]):
            raise ValueError(f"Clear Wall alpha changed: {output}")

    installation = Image.open(source_installation_path(source)).convert("L")
    finish_pixels = np.asarray(finish) > 0
    if not np.any(finish_pixels):
        raise ValueError(f"Finish mask is empty: {finish_path}")
    relative = source.relative_to(PROJECT_ROOT).as_posix()
    is_radiator = (
        "/radiator-cover/" in relative
        or source.name.startswith("product-radiator-cover-")
    )
    if is_radiator:
        bounds = installation.getbbox()
        if bounds and np.any(finish_pixels[:bounds[1]]):
            raise ValueError(f"Radiator finish extends above the installation: {finish_path}")
    else:
        envelope = np.asarray(authored_finish_envelope(source, installation)) > 0
        if np.any(finish_pixels & ~envelope):
            raise ValueError(f"Finish escapes the authored furniture envelope: {finish_path}")


def main() -> None:
    parser = ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    source = args.source if args.source.is_absolute() else PROJECT_ROOT / args.source
    output = next_version_path(source)
    removal = removal_mask_path(output)
    if args.check:
        verify(source, output, removal)
        print(output.relative_to(PROJECT_ROOT))
        return
    candidate = args.candidate
    if candidate is None:
        candidate = CANDIDATE_ROOT / source.relative_to(PROJECT_ROOT)
        if not candidate.exists() and output.exists():
            # Reviewed non-canonical batches can be rebuilt idempotently from
            # their already approved empty output (for example, to refresh a
            # finish-mask algorithm) without publishing an unmasked frame.
            candidate = output
    elif not candidate.is_absolute():
        candidate = PROJECT_ROOT / candidate
    output, removal, finish = build(source, candidate)
    verify(source, output, removal)
    print(output.relative_to(PROJECT_ROOT))
    print(removal.relative_to(PROJECT_ROOT))
    print(finish.relative_to(PROJECT_ROOT))


if __name__ == "__main__":
    main()
