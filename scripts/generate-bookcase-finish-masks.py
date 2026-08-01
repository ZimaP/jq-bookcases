"""Build deterministic wood-only Bookcase finish mattes.

Each integrated photograph has an authored installation silhouette and an
independent protected-content matte.  The final finish mask is their exact
difference, so finish color can reach cabinet faces, shelves, crown, backing,
and base while books, plants, decor, lighting, and hardware remain untouched.

Clear Wall uses a reviewed matte derived from the transparent furniture layer;
its styled objects are removed by the same exclusion contract.
"""

from argparse import ArgumentParser
from pathlib import Path
import re

from PIL import Image, ImageChops


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = PROJECT_ROOT / "assets/photos/configurator"

SOURCES = (
    "furniture/bookcase/cabinet-base-shelves/clear-wall-furniture-v2.png",
    "furniture/bookcase/drawer-base-shelves/clear-wall-furniture-v2.png",
    "furniture/bookcase/full-open-shelving/clear-wall-furniture-v2.png",
    "integrated/bookcase/cabinet-base-shelves/center-recess-v1.png",
    "integrated/bookcase/cabinet-base-shelves/corner-wall-v1.png",
    "integrated/bookcase/cabinet-base-shelves/door-wall-v1.png",
    "integrated/bookcase/cabinet-base-shelves/fireplace-wall-v1.png",
    "integrated/bookcase/cabinet-base-shelves/left-niche-v1.png",
    "integrated/bookcase/cabinet-base-shelves/niche-layout-v1.png",
    "integrated/bookcase/cabinet-base-shelves/right-niche-v1.png",
    "integrated/bookcase/drawer-base-shelves/center-recess-v1.png",
    "integrated/bookcase/drawer-base-shelves/corner-wall-v1.png",
    "integrated/bookcase/drawer-base-shelves/door-wall-v1.png",
    "integrated/bookcase/drawer-base-shelves/fireplace-wall-v1.png",
    "integrated/bookcase/drawer-base-shelves/left-niche-v2.png",
    "integrated/bookcase/drawer-base-shelves/niche-layout-v2.png",
    "integrated/bookcase/drawer-base-shelves/right-niche-v2.png",
    "integrated/bookcase/drawer-base-shelves/window-wall-v1.png",
    "integrated/bookcase/full-open-shelving/center-recess-v1.png",
    "integrated/bookcase/full-open-shelving/corner-wall-v1.png",
    "integrated/bookcase/full-open-shelving/door-wall-v1.png",
    "integrated/bookcase/full-open-shelving/fireplace-wall-v1.png",
    "integrated/bookcase/full-open-shelving/left-niche-v1.png",
    "integrated/bookcase/full-open-shelving/niche-layout-v1.png",
    "integrated/bookcase/full-open-shelving/right-niche-v1.png",
    "integrated/bookcase/full-open-shelving/window-wall-v1.png",
)


def authored_path(source, suffix):
    if "clear-wall-furniture" in source.name:
        name = re.sub(r"clear-wall-furniture-v\d+\.png$", f"clear-wall-{suffix}.png", source.name)
    else:
        name = re.sub(r"-v\d+\.png$", f"-{suffix}.png", source.name)
    return source.with_name(name)


def installation_mask(source):
    path = authored_path(source, "finish-installation-v1")
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("L")


def finish_mask(source):
    installation = installation_mask(source)
    exclusion_path = authored_path(source, "finish-exclusions-v1")
    if not exclusion_path.exists():
        raise FileNotFoundError(exclusion_path)
    exclusion = Image.open(exclusion_path).convert("L")
    if installation.size != exclusion.size:
        raise ValueError(f"Mismatched Bookcase mattes for {source.relative_to(PROJECT_ROOT)}")
    return ImageChops.subtract(installation, exclusion)


def output_path(source):
    return authored_path(source, "finish-mask-v3")


def images_match(expected, path):
    if not path.exists():
        return False
    actual = Image.open(path).convert("L")
    return actual.size == expected.size and ImageChops.difference(actual, expected).getbbox() is None


def main():
    parser = ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    stale = []
    for relative in SOURCES:
        source = ASSET_ROOT / relative
        mask = finish_mask(source)
        target = output_path(source)
        if args.check:
            if not images_match(mask, target):
                stale.append(target)
        else:
            mask.save(target, optimize=True)
        print(target.relative_to(PROJECT_ROOT))
    if stale:
        paths = "\n".join(str(path.relative_to(PROJECT_ROOT)) for path in stale)
        raise SystemExit(f"Bookcase finish mattes are stale:\n{paths}")


if __name__ == "__main__":
    main()
