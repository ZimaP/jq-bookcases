"""Generate soft wood-finish masks for the integrated Bookcase preview renders."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = PROJECT_ROOT / "assets/photos/configurator/integrated/bookcase"

RECTANGLES = {
    "niche-layout": [(145, 55, 1390, 840)],
    "left-niche": [(165, 55, 1375, 835)],
    "right-niche": [(155, 55, 1375, 835)],
    "fireplace-wall": [(210, 45, 595, 820), (940, 45, 1325, 820)],
    "center-recess": [(205, 45, 595, 820), (940, 45, 1330, 820)],
    "window-wall": [(225, 55, 620, 840), (915, 55, 1310, 840)],
    "door-wall": [(185, 55, 625, 805), (910, 55, 1350, 805)],
}

STYLE_RECTANGLES = {
    ("cabinet-base-shelves", "door-wall"): [
        (223, 168, 626, 790),
        (909, 168, 1312, 790),
    ],
    ("drawer-base-shelves", "door-wall"): [
        (225, 138, 616, 800),
        (914, 138, 1306, 800),
    ],
    ("full-open-shelving", "door-wall"): [
        (187, 86, 604, 818),
        (911, 86, 1335, 818),
        (584, 86, 934, 160),
    ],
    ("cabinet-base-shelves", "fireplace-wall"): [
        (193, 84, 520, 823),
        (1000, 84, 1324, 823),
    ],
    ("drawer-base-shelves", "fireplace-wall"): [
        (200, 103, 513, 816),
        (1015, 103, 1331, 816),
    ],
    ("full-open-shelving", "fireplace-wall"): [
        (289, 108, 512, 772),
        (1018, 108, 1243, 772),
    ],
    ("drawer-base-shelves", "window-wall"): [
        (270, 131, 590, 841),
        (935, 131, 1273, 841),
        (257, 640, 1274, 841),
    ],
    ("full-open-shelving", "window-wall"): [
        (279, 137, 592, 826),
        (940, 137, 1252, 826),
        (279, 136, 1252, 201),
    ],
}

CORNER_POLYGONS = {
    "cabinet-base-shelves": [
        [(75, 45), (820, 175), (820, 735), (75, 890)],
        [(820, 175), (1470, 35), (1470, 930), (820, 735)],
    ],
    "drawer-base-shelves": [
        [(125, 20), (825, 155), (825, 815), (125, 950)],
        [(825, 155), (1410, 20), (1410, 960), (825, 815)],
    ],
    "full-open-shelving": [
        [(20, 15), (845, 155), (845, 825), (20, 940)],
        [(845, 155), (1520, 10), (1520, 945), (845, 825)],
    ],
}


def spatial_mask(size, style_id, layout_id):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)

    if layout_id == "corner-wall":
        for polygon in CORNER_POLYGONS[style_id]:
            draw.polygon(polygon, fill=255)
        return np.asarray(mask) > 0

    rectangles = STYLE_RECTANGLES.get((style_id, layout_id), RECTANGLES[layout_id])
    for rectangle in rectangles:
        draw.rectangle(rectangle, fill=255)

    return np.asarray(mask) > 0


def finish_mask(source):
    image = Image.open(source).convert("RGB")
    hsv = np.asarray(image.convert("HSV"))
    rgb = np.asarray(image)

    hue = hsv[:, :, 0]
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    red_blue_separation = rgb[:, :, 0].astype(np.int16) - rgb[:, :, 2].astype(np.int16)

    wood = (
        (hue >= 8)
        & (hue <= 36)
        & (saturation >= 70)
        & (value >= 24)
        & (value <= 248)
        & (red_blue_separation >= 50)
    )

    style_id = source.parent.name
    layout_id = source.stem.removesuffix("-v1")
    selected = wood & spatial_mask(image.size, style_id, layout_id)

    mask = Image.fromarray(np.where(selected, 255, 0).astype(np.uint8), mode="L")
    mask = mask.filter(ImageFilter.MaxFilter(3))
    mask = mask.filter(ImageFilter.MinFilter(3))
    return mask.filter(ImageFilter.GaussianBlur(1.1))


def main():
    sources = sorted(
        source
        for source in ASSET_ROOT.glob("*/*-v1.png")
        if "-finish-mask-" not in source.name
    )
    if not sources:
        raise SystemExit("No integrated preview PNGs found.")

    for source in sources:
        target = source.with_name(source.name.replace("-v1.png", "-finish-mask-v1.png"))
        finish_mask(source).save(target, optimize=True)
        print(target.relative_to(PROJECT_ROOT))


if __name__ == "__main__":
    main()
