"""Build camera-matched Clear Wall bookcase layers from approved concept art.

The canonical Clear Wall room has a rear wall/floor junction near y=686. The
original furniture layers came from unrelated room renders and ended at y=860,
so they retained a foreground camera scale. These replacements use complete,
front-on furniture from the approved Between Openings concepts, preserve each
source's x/y aspect ratio, and place every unit against the canonical wall.
"""

from argparse import ArgumentParser
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = PROJECT_ROOT / "assets/photos/configurator"
CANVAS_SIZE = (1536, 1024)
TARGET_TOP = 108
TARGET_HEIGHT = 604

# Coordinates use exclusive right/bottom edges. The silhouette bands exclude
# source-room wall and floor pixels while retaining the complete crown, sides,
# backing, base, and intentional edge fillers of each furniture installation.
STYLES = {
    "cabinet-base-shelves": {
        "source": "concept-cabinets-shelves-between-openings-v1.png",
        "source_envelope": (365, 148, 1164, 802),
        "silhouette_bands": (
            (369, 148, 1163, 183),
            (365, 183, 1164, 802),
        ),
    },
    "drawer-base-shelves": {
        "source": "concept-drawers-shelves-between-openings-v1.png",
        "source_envelope": (389, 147, 1146, 790),
        "silhouette_bands": (
            (389, 147, 1145, 187),
            (389, 187, 1146, 790),
        ),
    },
    "full-open-shelving": {
        "source": "concept-full-shelving-between-openings-v1.png",
        "source_envelope": (324, 168, 1209, 816),
        "silhouette_bands": (
            (324, 168, 1209, 218),
            (332, 218, 1209, 816),
        ),
    },
}


def build_silhouette(bands):
    silhouette = Image.new("L", CANVAS_SIZE, 0)
    draw = ImageDraw.Draw(silhouette)
    for left, top, right, bottom in bands:
        draw.rectangle((left, top, right - 1, bottom - 1), fill=255)
    return silhouette


def build_finish_mask(source, silhouette):
    """Select warm wood pixels while leaving decor and hardware unchanged."""
    rgb = np.asarray(source).astype(np.int16)
    hsv = np.asarray(source.convert("HSV"))
    selected = (
        (hsv[:, :, 0] >= 8)
        & (hsv[:, :, 0] <= 36)
        & (hsv[:, :, 1] >= 52)
        & (hsv[:, :, 2] >= 24)
        & (hsv[:, :, 2] <= 250)
        & ((rgb[:, :, 0] - rgb[:, :, 2]) >= 34)
        & (np.asarray(silhouette) > 0)
    )
    mask = Image.fromarray(np.where(selected, 255, 0).astype(np.uint8))
    mask = mask.filter(ImageFilter.MaxFilter(3))
    mask = mask.filter(ImageFilter.MinFilter(3))
    return mask.filter(ImageFilter.GaussianBlur(0.8))


def build_style(style_id, definition):
    source = Image.open(ASSET_ROOT / definition["source"]).convert("RGB")
    if source.size != CANVAS_SIZE:
        raise ValueError(f"{definition['source']} must be {CANVAS_SIZE}, got {source.size}")

    silhouette = build_silhouette(definition["silhouette_bands"])
    finish_mask = build_finish_mask(source, silhouette)
    source_envelope = definition["source_envelope"]
    source_width = source_envelope[2] - source_envelope[0]
    source_height = source_envelope[3] - source_envelope[1]
    target_width = round(source_width * TARGET_HEIGHT / source_height)
    scale_x = target_width / source_width
    scale_y = TARGET_HEIGHT / source_height
    if abs(scale_x - scale_y) / scale_y > 0.002:
        raise ValueError(f"{style_id} would receive a non-uniform transform")

    furniture_crop = source.crop(source_envelope).convert("RGBA")
    furniture_crop.putalpha(silhouette.crop(source_envelope))
    furniture_crop = furniture_crop.resize(
        (target_width, TARGET_HEIGHT), Image.Resampling.LANCZOS
    )
    mask_crop = finish_mask.crop(source_envelope).resize(
        (target_width, TARGET_HEIGHT), Image.Resampling.LANCZOS
    )
    mask_crop = ImageChops.multiply(mask_crop, furniture_crop.getchannel("A"))

    target_left = round((CANVAS_SIZE[0] - target_width) / 2)
    layer = Image.new("RGBA", CANVAS_SIZE)
    layer.alpha_composite(furniture_crop, (target_left, TARGET_TOP))
    mask = Image.new("L", CANVAS_SIZE)
    mask.paste(mask_crop, (target_left, TARGET_TOP))
    envelope = (
        target_left,
        TARGET_TOP,
        target_left + target_width,
        TARGET_TOP + TARGET_HEIGHT,
    )
    return layer, mask, envelope


def output_paths(style_id):
    output_dir = ASSET_ROOT / "furniture/bookcase" / style_id
    return (
        output_dir / "clear-wall-furniture-v2.png",
        output_dir / "clear-wall-finish-mask-v2.png",
    )


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
        help="verify committed layers match this generator without rewriting them",
    )
    args = parser.parse_args()

    stale = []
    for style_id, definition in STYLES.items():
        layer, mask, envelope = build_style(style_id, definition)
        layer_path, mask_path = output_paths(style_id)
        if args.check:
            if not images_match(layer, layer_path):
                stale.append(layer_path)
            if not images_match(mask, mask_path):
                stale.append(mask_path)
        else:
            layer_path.parent.mkdir(parents=True, exist_ok=True)
            layer.save(layer_path, optimize=True)
            mask.save(mask_path, optimize=True)
        print(f"{style_id}: envelope={envelope}")

    if stale:
        paths = "\n".join(str(path.relative_to(PROJECT_ROOT)) for path in stale)
        raise SystemExit(f"Clear Wall assets are stale:\n{paths}")


if __name__ == "__main__":
    main()
