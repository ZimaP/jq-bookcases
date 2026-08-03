#!/usr/bin/env python3
"""Blender worker for the universal guided photoreal preview matrix.

The JavaScript contract owns every product descriptor and renderer-neutral
primitive.  This worker validates that package before importing ``bpy``, then
performs only unit/axis conversion, mesh construction, Phase 7-style material
translation, topology-aware room presentation, and deterministic rendering.
It never derives, repairs, substitutes, or scales customer product geometry.
"""

from __future__ import annotations

import argparse
from decimal import Decimal
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys
import traceback
from typing import Any, Iterable


PACKAGE_KIND = "jq-photoreal-preview-matrix-render-package"
PACKAGE_SCHEMA_VERSION = 1
PIPELINE_VERSION = "2026.08-universal-photoreal-preview-matrix-v1"
PRESENTATION_VERSION = "phase7-warm-residential-matrix-v1"
CAPTURE_VERSION = "cycles-1920x1280-256-v1"
PACKAGE_KEY_RE = re.compile(r"^jq-photoreal-preview-matrix-v1-[a-f0-9]{64}$")
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/+:\-]{0,511}$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")

WIDTH = 1920
HEIGHT = 1280
SAMPLES = 256
WEBP_QUALITY = 92
MASTER_COLOR_DEPTH = "16"
WARM_HDR_SHA256 = "49db5b6e13c5b5239d8aca84c055c586dfc71aeaf1e1db64487f5bf8bab66db2"
INCHES_TO_METERS = 0.0254
MAX_PACKAGE_BYTES = 128 * 1024 * 1024
MAX_MASTER_BYTES = 256 * 1024 * 1024
MAX_WEBP_BYTES = 64 * 1024 * 1024
GEOMETRY_TOLERANCE = 2e-6

TOP_LEVEL_KEYS = {
    "kind", "schemaVersion", "pipelineVersion", "authority", "identity",
    "canonicalFixture", "geometry", "topology", "materials", "presentation",
    "capture", "output", "packageKey",
}
SUPPORTED_GEOMETRY = {"box", "crown_profile_extrusion", "cylinder"}
SUPPORTED_SLOTS = {"back", "case", "front", "side", "hardware", "led", "screen", "toe"}


class MatrixWorkerError(RuntimeError):
    """Expected fail-closed matrix worker error."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def fail(code: str, message: str) -> None:
    raise MatrixWorkerError(code, message)


def exact_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        actual = sorted(value) if isinstance(value, dict) else type(value).__name__
        fail("UNKNOWN_OR_MISSING_PROPERTY", f"{label} keys are invalid: {actual!r}")
    return value


def finite(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        fail("NON_FINITE_NUMBER", f"{label} must be a finite JSON number")
    result = float(value)
    if not math.isfinite(result):
        fail("NON_FINITE_NUMBER", f"{label} must be finite")
    return result


def positive(value: Any, label: str) -> float:
    result = finite(value, label)
    if result <= 0:
        fail("NON_POSITIVE_NUMBER", f"{label} must be positive")
    return result


def integer(value: Any, label: str, minimum: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        fail("INVALID_INTEGER", f"{label} must be an integer")
    if minimum is not None and value < minimum:
        fail("INVALID_INTEGER", f"{label} must be at least {minimum}")
    return value


def safe_id(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SAFE_ID_RE.fullmatch(value):
        fail("INVALID_IDENTIFIER", f"{label} is not a safe deterministic ID")
    return value


def point(value: Any, label: str) -> dict[str, float]:
    item = exact_keys(value, {"x", "y", "z"}, label)
    return {axis: finite(item[axis], f"{label}.{axis}") for axis in "xyz"}


def bounds(value: Any, label: str) -> dict[str, dict[str, float]]:
    item = exact_keys(value, {"min", "max"}, label)
    low = point(item["min"], f"{label}.min")
    high = point(item["max"], f"{label}.max")
    if any(high[axis] <= low[axis] for axis in "xyz"):
        fail("INVALID_BOUNDS", f"{label} must have positive extent on every axis")
    return {"min": low, "max": high}


def canonical_equal(left: Any, right: Any) -> bool:
    return js_stable_stringify(left) == js_stable_stringify(right)


def js_stable_stringify(value: Any) -> str:
    """Match ECMAScript JSON number formatting for the package key."""
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            fail("NON_FINITE_NUMBER", "Canonical payload contains a non-finite number")
        if value == 0:
            return "0"
        if value.is_integer():
            return str(int(value))
        rendered = repr(value)
        magnitude = abs(value)
        if "e" in rendered.lower() and 1e-6 <= magnitude < 1e21:
            return format(Decimal(rendered), "f")
        return rendered.replace("e-0", "e-").replace("e+0", "e+")
    if isinstance(value, list):
        return "[" + ",".join(js_stable_stringify(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(
            f"{js_stable_stringify(key)}:{js_stable_stringify(value[key])}"
            for key in sorted(value)
        ) + "}"
    fail("INVALID_JSON_VALUE", "Canonical payload contains an unsupported value")
    raise AssertionError("unreachable")


def hash_canonical(value: Any) -> str:
    return hashlib.sha256(js_stable_stringify(value).encode("utf-8")).hexdigest()


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_package(path: Path) -> dict[str, Any]:
    if not path.is_file() or path.is_symlink():
        fail("PACKAGE_FILE_MISSING", f"Package is not a regular file: {path}")
    raw = path.read_bytes()
    if not raw or len(raw) > MAX_PACKAGE_BYTES:
        fail("PACKAGE_SIZE_INVALID", f"Package size is outside the supported range: {len(raw)}")
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail("PACKAGE_JSON_INVALID", f"Package JSON is invalid: {error}")
    if not isinstance(value, dict):
        fail("PACKAGE_JSON_INVALID", "Package root must be an object")
    return value


def validate_package(package: dict[str, Any]) -> dict[str, Any]:
    exact_keys(package, TOP_LEVEL_KEYS, "package")
    if (
        package["kind"] != PACKAGE_KIND
        or package["schemaVersion"] != PACKAGE_SCHEMA_VERSION
        or package["pipelineVersion"] != PIPELINE_VERSION
    ):
        fail("PACKAGE_VERSION_INVALID", "Package kind, schema, or pipeline version is unsupported")

    authority = package["authority"]
    if (
        not isinstance(authority, dict)
        or authority.get("customerMaterialApproved") is not False
        or authority.get("customerBeautyRenderApproved") is not False
        or authority.get("materialColorReferenceStatus") != "UNVERIFIED"
    ):
        fail("CUSTOMER_APPROVAL_FORBIDDEN", "Approval flags must remain false and material color unverified")
    material_authority = package.get("materials", {}).get("authority", {})
    if (
        material_authority.get("customerMaterialApproved") is not False
        or material_authority.get("customerBeautyRenderApproved") is not False
        or material_authority.get("materialColorReferenceStatus") != "UNVERIFIED"
    ):
        fail("CUSTOMER_APPROVAL_FORBIDDEN", "Material authority approval flags drifted")

    identity = package["identity"]
    product_id = safe_id(identity.get("productId"), "identity.productId")
    layout_id = safe_id(identity.get("layoutId"), "identity.layoutId")
    if identity.get("key") != f"{product_id}:{layout_id}":
        fail("IDENTITY_KEY_MISMATCH", "Matrix identity key does not match product/layout")
    for key in ("geometryFingerprint", "selectionFingerprint", "specificationFingerprint"):
        safe_id(identity.get(key), f"identity.{key}")

    geometry = package["geometry"]
    if geometry.get("units") != "inches" or geometry.get("targetUnits") != "meters":
        fail("GEOMETRY_UNITS_INVALID", "Matrix geometry units are unsupported")
    product_bounds = bounds(geometry.get("productBounds"), "geometry.productBounds")
    descriptors = geometry.get("descriptors")
    plans = geometry.get("renderPlans")
    if not isinstance(descriptors, list) or not descriptors:
        fail("MISSING_DESCRIPTORS", "Package has no authoritative descriptors")
    if not isinstance(plans, list) or len(plans) != len(descriptors):
        fail("RENDER_PLAN_PARITY_FAILED", "Descriptor/render-plan cardinality differs")
    component_ids: set[str] = set()
    object_ids: set[str] = set()
    submesh_count = 0
    for index, (descriptor, plan) in enumerate(zip(descriptors, plans)):
        component_id = safe_id(descriptor.get("componentId"), f"descriptors[{index}].componentId")
        if component_id in component_ids:
            fail("DUPLICATE_COMPONENT_ID", f"Duplicate descriptor {component_id}")
        component_ids.add(component_id)
        if plan.get("componentId") != component_id:
            fail("RENDER_PLAN_ORDER_MISMATCH", f"Render plan {index} targets another descriptor")
        bounds(descriptor.get("bounds"), f"{component_id}.descriptorBounds")
        validate_transform(descriptor.get("transform"), f"{component_id}.transform")
        bounds(plan.get("worldBounds"), f"{component_id}.worldBounds")
        submeshes = plan.get("submeshes")
        if not isinstance(submeshes, list) or not submeshes:
            fail("EMPTY_RENDER_PLAN", f"{component_id} has no submeshes")
        submesh_ids: set[str] = set()
        for submesh in submeshes:
            submesh_id = safe_id(submesh.get("submeshId"), f"{component_id}.submeshId")
            object_id = f"{component_id}::{submesh_id}"
            if submesh_id in submesh_ids or object_id in object_ids:
                fail("DUPLICATE_SUBMESH_ID", f"Duplicate submesh {object_id}")
            submesh_ids.add(submesh_id)
            object_ids.add(object_id)
            geometry_kind = submesh.get("geometry")
            if geometry_kind not in SUPPORTED_GEOMETRY:
                fail("UNSUPPORTED_PRIMITIVE", f"{object_id} uses {geometry_kind!r}")
            material_slot = submesh.get("materialSlot")
            if material_slot not in SUPPORTED_SLOTS:
                fail("UNSUPPORTED_MATERIAL_SLOT", f"{object_id} uses slot {material_slot!r}")
            bounds(submesh.get("bounds"), f"{object_id}.localBounds")
            bounds(submesh.get("worldBounds"), f"{object_id}.worldBounds")
            if geometry_kind == "crown_profile_extrusion":
                validate_crown_profile(submesh.get("profileGeometry"), object_id)
                if submesh.get("primitiveGeometry") is not None:
                    fail("MALFORMED_CROWN", f"{object_id} crown has primitive geometry")
            elif geometry_kind == "cylinder":
                validate_cylinder(submesh.get("primitiveGeometry"), object_id)
                if submesh.get("profileGeometry") is not None:
                    fail("MALFORMED_CYLINDER", f"{object_id} cylinder has a profile")
            elif submesh.get("profileGeometry") is not None or submesh.get("primitiveGeometry") is not None:
                fail("MALFORMED_BOX", f"{object_id} box carries extra geometry")
            submesh_count += 1

    topology = package["topology"]
    if topology.get("accepted") is not True or topology.get("layoutId") != layout_id:
        fail("TOPOLOGY_IDENTITY_MISMATCH", "Accepted topology does not match package layout")
    if not isinstance(topology.get("features"), dict) or not isinstance(topology.get("exclusionVolumes"), list):
        fail("TOPOLOGY_SHAPE_INVALID", "Topology features/exclusions are malformed")

    presentation = package["presentation"]
    if presentation.get("presentationVersion") != PRESENTATION_VERSION:
        fail("PRESENTATION_VERSION_INVALID", "Presentation version is unsupported")
    validate_camera(presentation.get("camera"), product_bounds)
    lights = presentation.get("lights")
    if not isinstance(lights, list) or len(lights) < 2:
        fail("PRESENTATION_LIGHTS_INVALID", "Key and fill lights are required")
    if lights[0].get("role") != "soft-daylight-key" or lights[1].get("role") != "cool-neutral-fill":
        fail("PRESENTATION_LIGHTS_INVALID", "Phase 7 key/fill roles drifted")
    pucks = [light for light in lights if light.get("role") == "warm-puck-pool"]
    if len(pucks) != presentation.get("dynamicPuckLightCount"):
        fail("PUCK_LIGHT_COUNT_MISMATCH", "Dynamic puck light count drifted")
    for index, light in enumerate(lights):
        validate_light(light, f"presentation.lights[{index}]")
    world = presentation.get("world", {})
    if (
        world.get("environmentAssetPath") != "assets/environments/jq-warm-interior.hdr"
        or world.get("environmentSha256") != WARM_HDR_SHA256
        or world.get("projection") != "EQUIRECTANGULAR"
    ):
        fail("ENVIRONMENT_IDENTITY_INVALID", "Warm HDR path or SHA-256 drifted")

    capture = package["capture"]
    if (
        capture.get("captureVersion") != CAPTURE_VERSION
        or capture.get("engine") != "CYCLES"
        or capture.get("blenderEngine") != "CYCLES"
        or capture.get("width") != WIDTH
        or capture.get("height") != HEIGHT
        or capture.get("samples") != SAMPLES
        or capture.get("samplingSeed") != 170219
        or capture.get("denoising", {}).get("enabled") is not True
        or capture.get("denoising", {}).get("denoiser") != "OPENIMAGEDENOISE"
    ):
        fail("CAPTURE_POLICY_INVALID", "Cycles 1920x1280/256 capture policy drifted")

    output = package["output"]
    master = output.get("masterPng", {})
    webp = output.get("publicWebp", {})
    if (
        master.get("width") != WIDTH or master.get("height") != HEIGHT
        or master.get("colorDepth") != 16 or master.get("mimeType") != "image/png"
        or webp.get("width") != WIDTH or webp.get("height") != HEIGHT
        or webp.get("quality") != WEBP_QUALITY or webp.get("mimeType") != "image/webp"
    ):
        fail("OUTPUT_POLICY_INVALID", "Master/WebP output policy drifted")
    expected_suffix = f"/{product_id}/{layout_id}/preview-v1.webp"
    if not webp.get("path", "").endswith(expected_suffix):
        fail("OUTPUT_PATH_INVALID", "Published WebP path does not match the matrix key")

    without_key = {key: value for key, value in package.items() if key != "packageKey"}
    expected_key = f"jq-photoreal-preview-matrix-v1-{hash_canonical(without_key)}"
    if not isinstance(package["packageKey"], str) or not PACKAGE_KEY_RE.fullmatch(package["packageKey"]) or package["packageKey"] != expected_key:
        fail("STALE_PACKAGE_KEY", "Package key does not match canonical content")
    return {
        "identity": identity,
        "descriptors": descriptors,
        "plans": plans,
        "productBounds": product_bounds,
        "submeshCount": submesh_count,
    }


def validate_transform(value: Any, label: str) -> dict[str, Any]:
    transform = exact_keys(value, {"translation", "basis"}, label)
    point(transform["translation"], f"{label}.translation")
    basis = exact_keys(transform["basis"], {"x", "y", "z"}, f"{label}.basis")
    for axis in "xyz":
        point(basis[axis], f"{label}.basis.{axis}")
    return transform


def validate_crown_profile(value: Any, label: str) -> None:
    if not isinstance(value, dict) or value.get("kind") != "crown_profile_extrusion" or value.get("schemaVersion") != 1:
        fail("MALFORMED_CROWN", f"{label} has an unsupported crown profile")
    cross = value.get("crossSection", {})
    extrusion = value.get("extrusion", {})
    if (
        cross.get("heightAxis") != "y"
        or cross.get("projectionAxis") not in {"x", "z"}
        or extrusion.get("axis") not in {"x", "z"}
        or extrusion.get("axis") == cross.get("projectionAxis")
        or cross.get("projectionDirection") not in {-1, 1}
    ):
        fail("MALFORMED_CROWN", f"{label} crown axes are unsupported")
    outline = value.get("outline")
    if not isinstance(outline, list) or not 3 <= len(outline) <= 64:
        fail("MALFORMED_CROWN", f"{label} crown outline is malformed")
    for item in outline:
        height = finite(item.get("height"), f"{label}.outline.height")
        projection = finite(item.get("projection"), f"{label}.outline.projection")
        if not 0 <= height <= 1 or not 0 <= projection <= 1:
            fail("MALFORMED_CROWN", f"{label} crown outline leaves normalized bounds")


def validate_cylinder(value: Any, label: str) -> None:
    if not isinstance(value, dict) or value.get("schemaVersion") != 1 or value.get("kind") != "cylinder" or value.get("axis") != "y":
        fail("MALFORMED_CYLINDER", f"{label} has unsupported cylinder geometry")
    point(value.get("center"), f"{label}.center")
    radius = positive(value.get("radius"), f"{label}.radius")
    inner_radius = finite(value.get("innerRadius"), f"{label}.innerRadius")
    positive(value.get("depth"), f"{label}.depth")
    if inner_radius < 0 or inner_radius >= radius or value.get("segments") != 32:
        fail("MALFORMED_CYLINDER", f"{label} cylinder radii or segments are invalid")


def validate_camera(value: Any, expected_bounds: dict[str, Any]) -> None:
    if not isinstance(value, dict) or value.get("type") != "PERSP" or value.get("depthOfField", {}).get("enabled") is not False:
        fail("CAMERA_INVALID", "Presentation camera must be perspective with depth of field disabled")
    position = point(value.get("position"), "presentation.camera.position")
    target = point(value.get("target"), "presentation.camera.target")
    if all(abs(position[axis] - target[axis]) <= 1e-12 for axis in "xyz"):
        fail("CAMERA_INVALID", "Presentation camera position and target coincide")
    positive(value.get("lensMm"), "presentation.camera.lensMm")
    positive(value.get("sensorWidthMm"), "presentation.camera.sensorWidthMm")
    framing_bounds = bounds(value.get("framingBounds"), "presentation.camera.framingBounds")
    if any(
        framing_bounds["min"][axis] > expected_bounds["min"][axis] + GEOMETRY_TOLERANCE
        or framing_bounds["max"][axis] < expected_bounds["max"][axis] - GEOMETRY_TOLERANCE
        for axis in "xyz"
    ):
        fail("CAMERA_BOUNDS_DRIFT", "Dynamic camera framing does not contain the full product")


def validate_light(value: Any, label: str) -> None:
    if not isinstance(value, dict) or value.get("blenderType") not in {"AREA", "SPOT"}:
        fail("LIGHT_INVALID", f"{label} has unsupported type")
    safe_id(value.get("lightId"), f"{label}.lightId")
    point(value.get("position"), f"{label}.position")
    point(value.get("target"), f"{label}.target")
    positive(value.get("energyW"), f"{label}.energyW")
    color = value.get("color")
    if not isinstance(color, list) or len(color) != 3 or any(not 0 <= finite(channel, f"{label}.color") <= 1 for channel in color):
        fail("LIGHT_INVALID", f"{label} color is invalid")


def transform_source_point(source: dict[str, float], transform: dict[str, Any]) -> tuple[float, float, float]:
    translation = transform["translation"]
    basis = transform["basis"]
    world = {
        axis: float(translation[axis])
        + float(basis["x"][axis]) * source["x"]
        + float(basis["y"][axis]) * source["y"]
        + float(basis["z"][axis]) * source["z"]
        for axis in "xyz"
    }
    return (
        world["x"] * INCHES_TO_METERS,
        -world["z"] * INCHES_TO_METERS,
        world["y"] * INCHES_TO_METERS,
    )


BOX_FACES = [
    (0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4),
    (2, 6, 7, 3), (0, 2, 3, 1), (4, 5, 7, 6),
]


def box_vertices_faces(local_bounds: dict[str, Any], transform: dict[str, Any]) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
    low, high = local_bounds["min"], local_bounds["max"]
    vertices = [
        transform_source_point({"x": x, "y": y, "z": z}, transform)
        for x in (low["x"], high["x"])
        for y in (low["y"], high["y"])
        for z in (low["z"], high["z"])
    ]
    return vertices, list(BOX_FACES)


def crown_vertices_faces(local_bounds: dict[str, Any], transform: dict[str, Any], profile: dict[str, Any]) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
    low, high = local_bounds["min"], local_bounds["max"]
    cross = profile["crossSection"]
    projection_axis = cross["projectionAxis"]
    extrusion_axis = profile["extrusion"]["axis"]
    direction = int(cross["projectionDirection"])
    projection_start = low[projection_axis] if direction > 0 else high[projection_axis]
    projection_end = high[projection_axis] if direction > 0 else low[projection_axis]
    vertices: list[tuple[float, float, float]] = []
    for extrusion_value in (low[extrusion_axis], high[extrusion_axis]):
        for outline in profile["outline"]:
            source = {"x": 0.0, "y": 0.0, "z": 0.0}
            source[extrusion_axis] = extrusion_value
            source[projection_axis] = projection_start + (projection_end - projection_start) * float(outline["projection"])
            source["y"] = low["y"] + (high["y"] - low["y"]) * float(outline["height"])
            vertices.append(transform_source_point(source, transform))
    count = len(profile["outline"])
    faces: list[tuple[int, ...]] = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, count + following, count + index))
    return vertices, faces


def cylinder_vertices_faces(primitive: dict[str, Any], transform: dict[str, Any]) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
    center = primitive["center"]
    radius = float(primitive["radius"])
    inner_radius = float(primitive["innerRadius"])
    depth = float(primitive["depth"])
    segments = int(primitive["segments"])
    bottom_y = float(center["y"]) - depth / 2
    top_y = float(center["y"]) + depth / 2

    def ring(ring_radius: float, y_value: float) -> list[tuple[float, float, float]]:
        return [
            transform_source_point({
                "x": float(center["x"]) + ring_radius * math.cos(2 * math.pi * index / segments),
                "y": y_value,
                "z": float(center["z"]) + ring_radius * math.sin(2 * math.pi * index / segments),
            }, transform)
            for index in range(segments)
        ]

    outer_bottom = ring(radius, bottom_y)
    outer_top = ring(radius, top_y)
    vertices = outer_bottom + outer_top
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((index, following, segments + following, segments + index))
    if inner_radius == 0:
        bottom_center = len(vertices)
        vertices.append(transform_source_point({"x": center["x"], "y": bottom_y, "z": center["z"]}, transform))
        top_center = len(vertices)
        vertices.append(transform_source_point({"x": center["x"], "y": top_y, "z": center["z"]}, transform))
        for index in range(segments):
            following = (index + 1) % segments
            faces.append((bottom_center, following, index))
            faces.append((top_center, segments + index, segments + following))
        return vertices, faces
    inner_bottom_start = len(vertices)
    vertices.extend(ring(inner_radius, bottom_y))
    inner_top_start = len(vertices)
    vertices.extend(ring(inner_radius, top_y))
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((inner_bottom_start + index, inner_top_start + index, inner_top_start + following, inner_bottom_start + following))
        faces.append((index, inner_bottom_start + index, inner_bottom_start + following, following))
        faces.append((segments + index, segments + following, inner_top_start + following, inner_top_start + index))
    return vertices, faces


def mesh_bounds(vertices: Iterable[tuple[float, float, float]]) -> dict[str, dict[str, float]]:
    values = list(vertices)
    return {
        "min": {axis: min(vertex[index] for vertex in values) for index, axis in enumerate("xyz")},
        "max": {axis: max(vertex[index] for vertex in values) for index, axis in enumerate("xyz")},
    }


def source_bounds_to_blender(value: dict[str, Any]) -> dict[str, dict[str, float]]:
    low, high = value["min"], value["max"]
    corners = [
        (x * INCHES_TO_METERS, -z * INCHES_TO_METERS, y * INCHES_TO_METERS)
        for x in (low["x"], high["x"])
        for y in (low["y"], high["y"])
        for z in (low["z"], high["z"])
    ]
    return mesh_bounds(corners)


def same_bounds(left: dict[str, Any], right: dict[str, Any], tolerance: float = GEOMETRY_TOLERANCE) -> bool:
    return all(
        abs(float(left[side][axis]) - float(right[side][axis])) <= tolerance
        for side in ("min", "max") for axis in "xyz"
    )


def create_mesh_object(bpy: Any, bmesh: Any, name: str, vertices: list[tuple[float, float, float]], faces: list[tuple[int, ...]], collection: Any, material: Any) -> Any:
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    if mesh.validate(verbose=False, clean_customdata=False):
        fail("MESH_GEOMETRY_CORRECTED", f"Blender attempted to repair {name}")
    mesh.update(calc_edges=True)
    normal_mesh = bmesh.new()
    normal_mesh.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(normal_mesh, faces=list(normal_mesh.faces))
    normal_mesh.to_mesh(mesh)
    normal_mesh.free()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    mesh.materials.append(material)
    return obj


def set_socket(node: Any, name: str, value: Any) -> None:
    socket = node.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def create_principled_material(bpy: Any, name: str, recipe: dict[str, Any]) -> Any:
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
    set_socket(shader, "Base Color", tuple(recipe["baseColor"]))
    set_socket(shader, "Metallic", float(recipe.get("metallic", 0)))
    set_socket(shader, "Roughness", float(recipe.get("roughness", 0.5)))
    set_socket(shader, "IOR", float(recipe.get("ior", 1.5)))
    set_socket(shader, "Coat Weight", float(recipe.get("coatWeight", 0)))
    set_socket(shader, "Coat Roughness", float(recipe.get("coatRoughness", 0.03)))
    set_socket(shader, "Transmission Weight", float(recipe.get("transmissionWeight", 0)))
    set_socket(shader, "Emission Color", tuple(recipe.get("emissionColor", [0, 0, 0, 1])))
    set_socket(shader, "Emission Strength", float(recipe.get("emissionStrength", 0)))
    tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material.diffuse_color = tuple(recipe["baseColor"])
    return material


def create_oak_material(bpy: Any, name: str, recipe: dict[str, Any], bands_direction: str) -> Any:
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
    geometry = tree.nodes.new("ShaderNodeNewGeometry")
    noise = tree.nodes.new("ShaderNodeTexNoise")
    wave = tree.nodes.new("ShaderNodeTexWave")
    fiber = tree.nodes.new("ShaderNodeTexNoise")
    mix = tree.nodes.new("ShaderNodeMixRGB")
    tone = tree.nodes.new("ShaderNodeMapRange")
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    bump = tree.nodes.new("ShaderNodeBump")
    noise.noise_dimensions = "4D"
    set_socket(noise, "Scale", 2.2)
    set_socket(noise, "Detail", 2.0)
    set_socket(noise, "Roughness", 0.42)
    set_socket(noise, "Distortion", 0.05)
    set_socket(noise, "W", 0.37)
    wave.wave_type = "BANDS"
    wave.bands_direction = bands_direction
    wave.wave_profile = "SIN"
    # World-metre coordinates make the grain frequency consistent from a
    # narrow stile to a full back panel.  Low distortion prevents the broad,
    # wavy zebra bands produced by Generated coordinates in the prototype.
    set_socket(wave, "Scale", float(recipe.get("grainScale", 10)) * 1.8)
    set_socket(wave, "Distortion", 0.35)
    set_socket(wave, "Detail", 2.0)
    fiber.noise_dimensions = "4D"
    set_socket(fiber, "Scale", 72.0)
    set_socket(fiber, "Detail", 2.0)
    set_socket(fiber, "Roughness", 0.48)
    set_socket(fiber, "Distortion", 0.0)
    set_socket(fiber, "W", 0.61)
    mix.blend_type = "MIX"
    mix.use_clamp = True
    mix.inputs[0].default_value = 0.22
    set_socket(tone, "From Min", 0.0)
    set_socket(tone, "From Max", 1.0)
    set_socket(tone, "To Min", 0.49)
    set_socket(tone, "To Max", 0.64)
    tone.clamp = True
    stops = recipe["baseColorRamp"]
    while len(ramp.color_ramp.elements) > 2:
        ramp.color_ramp.elements.remove(ramp.color_ramp.elements[-1])
    elements = [ramp.color_ramp.elements[0]]
    for stop in stops[1:-1]:
        elements.append(ramp.color_ramp.elements.new(float(stop[0])))
    elements.append(ramp.color_ramp.elements[-1])
    for element, stop in zip(elements, stops):
        element.position = float(stop[0])
        element.color = tuple(stop[1])
    set_socket(shader, "Metallic", float(recipe["metallic"]))
    set_socket(shader, "Roughness", float(recipe["roughness"]))
    set_socket(shader, "IOR", float(recipe["ior"]))
    set_socket(shader, "Coat Weight", float(recipe["coatWeight"]))
    set_socket(shader, "Coat Roughness", float(recipe["coatRoughness"]))
    set_socket(bump, "Strength", min(float(recipe["bumpStrength"]), 0.08))
    set_socket(bump, "Distance", min(float(recipe["bumpDistanceM"]), 0.00012))
    tree.links.new(geometry.outputs["Position"], noise.inputs["Vector"])
    tree.links.new(geometry.outputs["Position"], wave.inputs["Vector"])
    tree.links.new(geometry.outputs["Position"], fiber.inputs["Vector"])
    tree.links.new(noise.outputs["Fac"], mix.inputs[1])
    tree.links.new(wave.outputs["Color"], mix.inputs[2])
    tree.links.new(mix.outputs["Color"], tone.inputs["Value"])
    tree.links.new(tone.outputs["Result"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    tree.links.new(fiber.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material.diffuse_color = tuple(stops[2][1])
    return material


def build_materials(bpy: Any, package: dict[str, Any]) -> dict[str, Any]:
    materials_contract = package["materials"]
    recipes = materials_contract["recipes"]
    oak = recipes["natural-oak-visualization-v1"]
    result: dict[str, Any] = {
        "oak-vertical": create_oak_material(bpy, "JQ_NATURAL_OAK_VERTICAL", oak, "X"),
        "oak-long": create_oak_material(bpy, "JQ_NATURAL_OAK_LONG", oak, "Z"),
    }
    for slot, material_id in materials_contract["slotBindings"].items():
        if material_id == "natural-oak-visualization-v1":
            continue
        result[slot] = create_principled_material(bpy, f"JQ_{material_id.upper()}", recipes[material_id])
    room_recipes = package["presentation"]["roomMaterials"]
    result["room-wall"] = create_principled_material(bpy, "JQ_PRESENTATION_ROOM_WALL", room_recipes["wall"])
    result["room-floor"] = create_principled_material(bpy, "JQ_PRESENTATION_ROOM_FLOOR", room_recipes["floor"])
    result["room-opening"] = create_principled_material(bpy, "JQ_PRESENTATION_OPENING", room_recipes["opening"])
    result["room-glass"] = create_principled_material(bpy, "JQ_PRESENTATION_WINDOW_GLASS", room_recipes["glass"])
    return result


VERTICAL_GRAIN_ROLES = {
    "side_panel", "end_panel", "divider", "door", "drawer_front",
    "back_panel", "backing_panel", "front_stile", "front_field", "slat",
}


def material_for_submesh(materials: dict[str, Any], submesh: dict[str, Any]) -> Any:
    slot = submesh["materialSlot"]
    if slot in {"back", "case", "front", "side"}:
        return materials["oak-vertical" if submesh.get("grainRole") in VERTICAL_GRAIN_ROLES else "oak-long"]
    return materials[slot]


def build_product(bpy: Any, bmesh: Any, descriptors: list[dict[str, Any]], plans: list[dict[str, Any]], collection: Any, materials: dict[str, Any]) -> list[str]:
    object_names: list[str] = []
    for descriptor, plan in zip(descriptors, plans):
        transform = descriptor["transform"]
        for submesh in plan["submeshes"]:
            name = f"{descriptor['componentId']}::{submesh['submeshId']}"
            local_bounds = submesh["bounds"]
            if submesh["geometry"] == "box":
                vertices, faces = box_vertices_faces(local_bounds, transform)
            elif submesh["geometry"] == "crown_profile_extrusion":
                vertices, faces = crown_vertices_faces(local_bounds, transform, submesh["profileGeometry"])
            elif submesh["geometry"] == "cylinder":
                vertices, faces = cylinder_vertices_faces(submesh["primitiveGeometry"], transform)
            else:
                fail("UNSUPPORTED_PRIMITIVE", f"Unknown primitive for {name}")
            expected_bounds = source_bounds_to_blender(submesh["worldBounds"])
            if not same_bounds(mesh_bounds(vertices), expected_bounds):
                fail("MESH_BOUNDS_MISMATCH", f"{name} does not realize exact accepted world bounds")
            obj = create_mesh_object(bpy, bmesh, name, vertices, faces, collection, material_for_submesh(materials, submesh))
            obj["jq_component_id"] = descriptor["componentId"]
            obj["jq_submesh_id"] = submesh["submeshId"]
            obj["jq_geometry_authority"] = "guided-render-primitives.js"
            object_names.append(name)
    return object_names


def plane_mesh(bpy: Any, bmesh: Any, name: str, vertices: list[tuple[float, float, float]], collection: Any, material: Any) -> Any:
    return create_mesh_object(bpy, bmesh, name, vertices, [(0, 1, 2, 3)], collection, material)


def world_box(bpy: Any, bmesh: Any, name: str, source_bounds: dict[str, Any], collection: Any, material: Any) -> Any:
    identity = {
        "translation": {"x": 0, "y": 0, "z": 0},
        "basis": {
            "x": {"x": 1, "y": 0, "z": 0},
            "y": {"x": 0, "y": 1, "z": 0},
            "z": {"x": 0, "y": 0, "z": 1},
        },
    }
    vertices, faces = box_vertices_faces(source_bounds, identity)
    return create_mesh_object(bpy, bmesh, name, vertices, faces, collection, material)


def build_room_context(bpy: Any, bmesh: Any, package: dict[str, Any], collection: Any, materials: dict[str, Any]) -> list[str]:
    topology = package["topology"]
    product_bounds = package["geometry"]["productBounds"]
    camera_y = float(package["presentation"]["camera"]["position"]["y"])
    margin = max(1.3, (product_bounds["max"]["x"] - product_bounds["min"]["x"]) * 0.32)
    left = product_bounds["min"]["x"] - margin
    right = product_bounds["max"]["x"] + margin
    floor_z = min(0.0, product_bounds["min"]["z"])
    ceiling_z = max(float(topology["ceilingHeight"]) * INCHES_TO_METERS, product_bounds["max"]["z"] + 0.45)
    rear_y = product_bounds["min"]["y"] - 0.08
    front_y = camera_y + 1.2
    names: list[str] = []
    floor = plane_mesh(
        bpy, bmesh, "room-floor",
        [(left, rear_y, floor_z), (right, rear_y, floor_z), (right, front_y, floor_z), (left, front_y, floor_z)],
        collection, materials["room-floor"],
    )
    wall = plane_mesh(
        bpy, bmesh, "room-rear-wall",
        [(left, rear_y, floor_z), (left, rear_y, ceiling_z), (right, rear_y, ceiling_z), (right, rear_y, floor_z)],
        collection, materials["room-wall"],
    )
    names.extend([floor.name, wall.name])

    # A perpendicular wall at frame left supplies the residential corner cue
    # visible in the accepted Phase 7 presentation.  It is presentation-only
    # context and never participates in the authoritative topology or product
    # geometry.
    if topology["layoutId"] != "corner-wall":
        left_wall = plane_mesh(
            bpy, bmesh, "room-left-context-wall",
            [(left, rear_y, floor_z), (left, front_y, floor_z),
             (left, front_y, ceiling_z), (left, rear_y, ceiling_z)],
            collection, materials["room-wall"],
        )
        names.append(left_wall.name)

    # A small baseboard gives the wall/floor junction a residential contact cue.
    baseboard = world_box(bpy, bmesh, "room-baseboard", {
        "min": {"x": left / INCHES_TO_METERS, "y": 0, "z": -rear_y / INCHES_TO_METERS - 0.35},
        "max": {"x": right / INCHES_TO_METERS, "y": 4.5, "z": -rear_y / INCHES_TO_METERS},
    }, collection, materials["room-wall"])
    names.append(baseboard.name)

    features = topology.get("features", {})
    layout_id = topology["layoutId"]
    if layout_id in {"niche-layout", "left-niche", "right-niche"} and features.get("niche"):
        niche = features["niche"]["bounds"]
        wall_depth = max(3.0, float(features["niche"].get("depth", 14)))
        for side, x0, x1 in (
            ("left", niche["min"]["x"] - 1.25, niche["min"]["x"]),
            ("right", niche["max"]["x"], niche["max"]["x"] + 1.25),
        ):
            obj = world_box(bpy, bmesh, f"room-niche-{side}-return", {
                "min": {"x": x0, "y": 0, "z": -wall_depth},
                "max": {"x": x1, "y": topology["ceilingHeight"], "z": niche["max"]["z"]},
            }, collection, materials["room-wall"])
            names.append(obj.name)
    elif layout_id == "fireplace-wall" and features.get("fireplace"):
        feature = features["fireplace"]
        opening_width = float(feature["openingWidth"])
        opening_height = float(feature["openingHeight"])
        mantel_width = float(feature["mantelWidth"])
        projection_depth = float(feature["projectionDepth"])
        mantel_bounds = feature["mantelBounds"]
        surround_half_width = max(mantel_width / 2 + 2, opening_width / 2 + 6)
        surround_height = max(float(mantel_bounds["max"]["y"]) + 2, opening_height + 12)

        # The authoritative feature bounds are an exclusion volume, not a
        # renderable black solid.  Build a presentation-only chimney breast
        # from the same accepted dimensions, then place a thin firebox face on
        # its front plane.  This preserves product geometry while making the
        # fireplace identity visually truthful.
        surround = world_box(bpy, bmesh, "room-fireplace-surround", {
            "min": {"x": -surround_half_width, "y": 0, "z": -projection_depth},
            "max": {"x": surround_half_width, "y": surround_height, "z": 0},
        }, collection, materials["room-wall"])
        opening = world_box(bpy, bmesh, "room-fireplace-opening", {
            "min": {"x": -opening_width / 2, "y": 0, "z": -(projection_depth + 0.12)},
            "max": {"x": opening_width / 2, "y": opening_height, "z": -projection_depth},
        }, collection, materials["room-opening"])
        mantel = world_box(bpy, bmesh, "room-fireplace-mantel", {
            "min": {
                "x": float(mantel_bounds["min"]["x"]),
                "y": float(mantel_bounds["min"]["y"]),
                "z": -(projection_depth + 2),
            },
            "max": {
                "x": float(mantel_bounds["max"]["x"]),
                "y": float(mantel_bounds["max"]["y"]),
                "z": -projection_depth,
            },
        }, collection, materials["room-wall"])
        hearth = world_box(bpy, bmesh, "room-fireplace-hearth", {
            "min": {"x": -(opening_width / 2 + 6), "y": 0, "z": -(projection_depth + 4)},
            "max": {"x": opening_width / 2 + 6, "y": 2, "z": -projection_depth},
        }, collection, materials["room-floor"])
        names.extend([surround.name, opening.name, mantel.name, hearth.name])
    elif layout_id == "center-recess" and features.get("projection"):
        projection = world_box(bpy, bmesh, "room-center-projection", features["projection"]["bounds"], collection, materials["room-wall"])
        names.append(projection.name)
    elif layout_id == "window-wall" and features.get("window"):
        feature = features["window"]
        item = feature["bounds"]
        glass_bounds = {
            "min": {"x": item["min"]["x"], "y": item["min"]["y"], "z": item["max"]["z"] - 0.3},
            "max": {"x": item["max"]["x"], "y": item["max"]["y"], "z": item["max"]["z"]},
        }
        glass = world_box(bpy, bmesh, "room-window-glass", glass_bounds, collection, materials["room-glass"])
        names.append(glass.name)
        trim = 1.25
        for part, piece in (
            ("left", {"min": {"x": item["min"]["x"] - trim, "y": item["min"]["y"] - trim, "z": item["max"]["z"] - 0.8}, "max": {"x": item["min"]["x"], "y": item["max"]["y"] + trim, "z": item["max"]["z"]}}),
            ("right", {"min": {"x": item["max"]["x"], "y": item["min"]["y"] - trim, "z": item["max"]["z"] - 0.8}, "max": {"x": item["max"]["x"] + trim, "y": item["max"]["y"] + trim, "z": item["max"]["z"]}}),
            ("top", {"min": {"x": item["min"]["x"], "y": item["max"]["y"], "z": item["max"]["z"] - 0.8}, "max": {"x": item["max"]["x"], "y": item["max"]["y"] + trim, "z": item["max"]["z"]}}),
            ("sill", {"min": {"x": item["min"]["x"] - trim, "y": item["min"]["y"] - 0.5, "z": item["max"]["z"] - 1.3}, "max": {"x": item["max"]["x"] + trim, "y": item["min"]["y"] + trim, "z": item["max"]["z"] + 0.4}}),
        ):
            obj = world_box(bpy, bmesh, f"room-window-{part}-trim", piece, collection, materials["room-wall"])
            names.append(obj.name)
    elif layout_id == "door-wall" and features.get("door"):
        feature = features["door"]
        item = feature["bounds"]
        trim = float(feature.get("trimWidth", 3.5))
        door = world_box(bpy, bmesh, "room-door-opening", {
            "min": {"x": item["min"]["x"], "y": item["min"]["y"], "z": -0.12},
            "max": {"x": item["max"]["x"], "y": item["max"]["y"], "z": 0},
        }, collection, materials["room-opening"])
        names.append(door.name)
        for part, piece in (
            ("left", {"min": {"x": item["min"]["x"] - trim, "y": 0, "z": -0.8}, "max": {"x": item["min"]["x"], "y": item["max"]["y"] + trim, "z": 0}}),
            ("right", {"min": {"x": item["max"]["x"], "y": 0, "z": -0.8}, "max": {"x": item["max"]["x"] + trim, "y": item["max"]["y"] + trim, "z": 0}}),
            ("head", {"min": {"x": item["min"]["x"] - trim, "y": item["max"]["y"], "z": -0.8}, "max": {"x": item["max"]["x"] + trim, "y": item["max"]["y"] + trim, "z": 0}}),
        ):
            casing = world_box(bpy, bmesh, f"room-door-{part}-casing", piece, collection, materials["room-wall"])
            names.append(casing.name)
    elif layout_id == "corner-wall":
        right = float(topology["planes"]["rightWall"]["value"]) * INCHES_TO_METERS
        return_depth = float(features.get("corner", {}).get("returnRun", 48)) * INCHES_TO_METERS
        side_wall = plane_mesh(
            bpy, bmesh, "room-corner-return-wall",
            [(right, rear_y, floor_z), (right, front_y if return_depth <= 0 else rear_y + return_depth, floor_z),
             (right, front_y if return_depth <= 0 else rear_y + return_depth, ceiling_z), (right, rear_y, ceiling_z)],
            collection, materials["room-wall"],
        )
        names.append(side_wall.name)
    elif layout_id == "double-opening":
        for feature_name in ("leftOpening", "rightOpening"):
            feature = features.get(feature_name)
            if feature:
                item = feature["bounds"]
                obj = world_box(bpy, bmesh, f"room-{feature['id']}-shadow", {
                    "min": {"x": item["min"]["x"], "y": item["min"]["y"], "z": -0.12},
                    "max": {"x": item["max"]["x"], "y": item["max"]["y"], "z": 0},
                }, collection, materials["room-opening"])
                names.append(obj.name)
    return names


def track_to(obj: Any, target: dict[str, float]) -> None:
    from mathutils import Vector
    direction = Vector((target["x"], target["y"], target["z"])) - obj.location
    if direction.length <= 1e-12:
        fail("DEGENERATE_TARGET", f"{obj.name} target coincides with its position")
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def create_camera(bpy: Any, descriptor: dict[str, Any], collection: Any) -> Any:
    camera_data = bpy.data.cameras.new("JQ_MATRIX_BEAUTY_CAMERA")
    camera = bpy.data.objects.new("JQ_MATRIX_BEAUTY_CAMERA", camera_data)
    collection.objects.link(camera)
    position = descriptor["position"]
    camera.location = (position["x"], position["y"], position["z"])
    camera_data.type = descriptor["type"]
    camera_data.lens = descriptor["lensMm"]
    camera_data.sensor_width = descriptor["sensorWidthMm"]
    camera_data.sensor_fit = descriptor["sensorFit"]
    camera_data.clip_start = descriptor["clipStartM"]
    camera_data.clip_end = descriptor["clipEndM"]
    camera_data.dof.use_dof = False
    track_to(camera, descriptor["target"])
    return camera


def create_lights(bpy: Any, descriptors: list[dict[str, Any]], collection: Any) -> list[str]:
    names: list[str] = []
    for descriptor in descriptors:
        light_data = bpy.data.lights.new(descriptor["lightId"], descriptor["blenderType"])
        light = bpy.data.objects.new(descriptor["lightId"], light_data)
        collection.objects.link(light)
        position = descriptor["position"]
        light.location = (position["x"], position["y"], position["z"])
        light_data.color = tuple(descriptor["color"])
        light_data.energy = descriptor["energyW"]
        light_data.use_shadow = True
        light_data.diffuse_factor = 1
        light_data.specular_factor = 1
        light_data.volume_factor = 1
        if descriptor["blenderType"] == "AREA":
            light_data.shape = "RECTANGLE"
            light_data.size = descriptor["sizeM"]
            light_data.size_y = descriptor["sizeYM"]
        else:
            light_data.spot_size = descriptor["spotSizeRadians"]
            light_data.spot_blend = descriptor["spotBlend"]
            light_data.shadow_soft_size = descriptor["shadowSoftSizeM"]
        track_to(light, descriptor["target"])
        names.append(light.name)
    return names


def configure_world(bpy: Any, world_descriptor: dict[str, Any], project_root: Path) -> None:
    world = bpy.data.worlds.new("JQ_MATRIX_BEAUTY_WORLD")
    world.use_nodes = True
    tree = world.node_tree
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputWorld")
    background = tree.nodes.new("ShaderNodeBackground")
    background.inputs["Strength"].default_value = float(world_descriptor["strength"])
    environment_path = (project_root / world_descriptor["environmentAssetPath"]).resolve()
    if not environment_path.is_file() or project_root not in environment_path.parents:
        fail("ENVIRONMENT_ASSET_MISSING", f"Warm environment asset is unavailable: {environment_path}")
    if hash_file(environment_path) != world_descriptor["environmentSha256"]:
        fail("ENVIRONMENT_ASSET_HASH_MISMATCH", "Warm environment asset differs from its pinned SHA-256")
    environment = tree.nodes.new("ShaderNodeTexEnvironment")
    environment.image = bpy.data.images.load(str(environment_path), check_existing=False)
    environment.interpolation = "Linear"
    mapping = tree.nodes.new("ShaderNodeMapping")
    coordinates = tree.nodes.new("ShaderNodeTexCoord")
    mapping.inputs["Rotation"].default_value = tuple(world_descriptor["rotationEuler"])
    tree.links.new(coordinates.outputs["Generated"], mapping.inputs["Vector"])
    tree.links.new(mapping.outputs["Vector"], environment.inputs["Vector"])
    tree.links.new(environment.outputs["Color"], background.inputs["Color"])
    tree.links.new(background.outputs["Background"], output.inputs["Surface"])
    bpy.context.scene.world = world


def configure_cycles(bpy: Any, capture: dict[str, Any]) -> dict[str, str]:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = capture["samples"]
    scene.cycles.use_adaptive_sampling = capture["adaptiveSampling"]
    scene.cycles.adaptive_threshold = capture["adaptiveThreshold"]
    scene.cycles.adaptive_min_samples = capture["adaptiveMinSamples"]
    scene.cycles.seed = capture["samplingSeed"]
    scene.cycles.use_animated_seed = capture["animatedSeed"]
    scene.cycles.use_light_tree = capture["useLightTree"]
    scene.cycles.use_guiding = capture["useGuiding"]
    scene.cycles.max_bounces = capture["maxBounces"]
    scene.cycles.diffuse_bounces = capture["diffuseBounces"]
    scene.cycles.glossy_bounces = capture["glossyBounces"]
    scene.cycles.transmission_bounces = capture["transmissionBounces"]
    scene.cycles.transparent_max_bounces = capture["transparentBounces"]
    scene.cycles.volume_bounces = capture["volumeBounces"]
    scene.cycles.caustics_reflective = capture["reflectiveCaustics"]
    scene.cycles.caustics_refractive = capture["refractiveCaustics"]
    scene.cycles.sample_clamp_direct = capture["directClamp"]
    scene.cycles.sample_clamp_indirect = capture["indirectClamp"]
    scene.cycles.filter_width = capture["filterWidth"]
    scene.cycles.use_denoising = capture["denoising"]["enabled"]
    scene.cycles.denoiser = capture["denoising"]["denoiser"]
    scene.cycles.denoising_input_passes = capture["denoising"]["inputPasses"]
    scene.cycles.denoising_prefilter = capture["denoising"]["prefilter"]
    if hasattr(scene.cycles, "denoising_quality"):
        scene.cycles.denoising_quality = capture["denoising"]["quality"]

    backend = "CPU"
    device_name = "CPU"
    try:
        preferences = bpy.context.preferences.addons["cycles"].preferences
        preferences.compute_device_type = "METAL"
        preferences.get_devices()
        enabled = []
        for device in preferences.devices:
            use_device = device.type == "METAL"
            device.use = use_device
            if use_device:
                enabled.append(device.name)
        if enabled:
            scene.cycles.device = "GPU"
            backend = "METAL"
            device_name = ", ".join(enabled)
        else:
            scene.cycles.device = "CPU"
    except Exception:
        scene.cycles.device = "CPU"
    return {"backend": backend, "deviceName": device_name}


def configure_render(bpy: Any, capture: dict[str, Any]) -> None:
    scene = bpy.context.scene
    scene.render.resolution_x = capture["width"]
    scene.render.resolution_y = capture["height"]
    scene.render.resolution_percentage = capture["resolutionPercentage"]
    scene.render.pixel_aspect_x = capture["pixelAspectX"]
    scene.render.pixel_aspect_y = capture["pixelAspectY"]
    scene.render.film_transparent = False
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.render.use_file_extension = True
    scene.render.use_stamp = False
    scene.render.use_border = False
    scene.render.use_crop_to_border = False
    scene.render.dither_intensity = 1
    scene.display_settings.display_device = capture["colorManagement"]["displayDevice"]
    scene.view_settings.look = capture["colorManagement"]["look"]
    scene.view_settings.exposure = capture["colorManagement"]["exposure"]
    scene.view_settings.gamma = capture["colorManagement"]["gamma"]
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.unit_settings.length_unit = "METERS"


def render_outputs(bpy: Any, master_path: Path, beauty_path: Path) -> None:
    scene = bpy.context.scene
    scene.render.filepath = str(master_path)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = MASTER_COLOR_DEPTH
    scene.render.image_settings.compression = 15
    scene.render.image_settings.color_management = "FOLLOW_SCENE"
    bpy.ops.render.render(write_still=True)
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.quality = WEBP_QUALITY
    scene.render.image_settings.color_management = "FOLLOW_SCENE"
    scene.render.filepath = str(beauty_path)
    bpy.data.images["Render Result"].save_render(filepath=str(beauty_path), scene=scene)


def png_dimensions(path: Path) -> tuple[int, int, int]:
    raw = path.read_bytes()[:29]
    if len(raw) < 29 or raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
        fail("INVALID_MASTER_PNG", "Master output is not a PNG with an IHDR")
    width, height = struct.unpack(">II", raw[16:24])
    return width, height, raw[24]


def webp_dimensions(path: Path) -> tuple[int, int]:
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b"RIFF" or raw[8:12] != b"WEBP" or int.from_bytes(raw[4:8], "little") + 8 != len(raw):
        fail("INVALID_WEBP", "Beauty output is not a complete RIFF WebP")
    offset = 12
    while offset + 8 <= len(raw):
        kind = raw[offset:offset + 4]
        length = int.from_bytes(raw[offset + 4:offset + 8], "little")
        payload = offset + 8
        if payload + length > len(raw):
            fail("INVALID_WEBP", "Beauty output contains a truncated WebP chunk")
        if kind == b"VP8X" and length >= 10:
            return 1 + int.from_bytes(raw[payload + 4:payload + 7], "little"), 1 + int.from_bytes(raw[payload + 7:payload + 10], "little")
        if kind == b"VP8L" and length >= 5 and raw[payload] == 0x2F:
            b1, b2, b3, b4 = raw[payload + 1:payload + 5]
            return 1 + b1 + ((b2 & 0x3F) << 8), 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0F) << 10)
        if kind == b"VP8 " and length >= 10 and raw[payload + 3:payload + 6] == b"\x9d\x01\x2a":
            return int.from_bytes(raw[payload + 6:payload + 8], "little") & 0x3FFF, int.from_bytes(raw[payload + 8:payload + 10], "little") & 0x3FFF
        offset = payload + length + (length % 2)
    fail("INVALID_WEBP", "Beauty output contains no supported WebP dimensions")
    raise AssertionError("unreachable")


def output_record(path: Path, pass_name: str, mime_type: str, width: int, height: int, color_depth: int | None = None) -> dict[str, Any]:
    size = path.stat().st_size
    maximum = MAX_MASTER_BYTES if mime_type == "image/png" else MAX_WEBP_BYTES
    if size <= 0 or size > maximum:
        fail("OUTPUT_SIZE_INVALID", f"{pass_name} output size is outside the allowed range")
    record: dict[str, Any] = {
        "pass": pass_name,
        "path": str(path),
        "mimeType": mime_type,
        "width": width,
        "height": height,
        "bytes": size,
        "sha256": hash_file(path),
    }
    if color_depth is not None:
        record["colorDepth"] = color_depth
    return record


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def ensure_output_path(path: Path, output_root: Path, expected_name: str) -> Path:
    resolved_root = output_root.resolve()
    resolved = path.resolve()
    if resolved.name != expected_name or resolved_root not in resolved.parents:
        fail("OUTPUT_PATH_INVALID", f"Output must be named {expected_name} inside {resolved_root}")
    resolved.parent.mkdir(parents=True, exist_ok=True)
    return resolved


def run_worker(args: argparse.Namespace, package: dict[str, Any], validated: dict[str, Any]) -> dict[str, Any]:
    project_root = Path(args.project_root).resolve()
    output_root = Path(args.output_dir).resolve()
    if not project_root.is_dir() or not output_root.is_dir():
        fail("DIRECTORY_INVALID", "Project/output roots must exist")
    master_path = ensure_output_path(Path(args.master), output_root, "preview-v1-master.png")
    beauty_path = ensure_output_path(Path(args.beauty), output_root, "preview-v1.webp")
    result_path = ensure_output_path(Path(args.result), output_root, "render-result.json")
    blend_path = ensure_output_path(Path(args.blend), output_root, "preview-v1.blend")
    for path in (master_path, beauty_path, result_path, blend_path):
        if path.exists():
            fail("STALE_OUTPUT_PRESENT", f"Refusing to overwrite worker output: {path}")

    import bpy
    import bmesh

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    product_collection = bpy.data.collections.new("JQ_MATRIX_PRODUCT")
    room_collection = bpy.data.collections.new("JQ_MATRIX_ROOM")
    camera_collection = bpy.data.collections.new("JQ_MATRIX_CAMERAS")
    light_collection = bpy.data.collections.new("JQ_MATRIX_LIGHTS")
    for collection in (product_collection, room_collection, camera_collection, light_collection):
        scene.collection.children.link(collection)

    materials = build_materials(bpy, package)
    product_objects = build_product(
        bpy, bmesh, validated["descriptors"], validated["plans"],
        product_collection, materials,
    )
    room_objects = build_room_context(bpy, bmesh, package, room_collection, materials)
    camera = create_camera(bpy, package["presentation"]["camera"], camera_collection)
    light_objects = create_lights(bpy, package["presentation"]["lights"], light_collection)
    scene.camera = camera
    configure_world(bpy, package["presentation"]["world"], project_root)
    runtime = configure_cycles(bpy, package["capture"])
    configure_render(bpy, package["capture"])
    render_outputs(bpy, master_path, beauty_path)

    master_width, master_height, master_depth = png_dimensions(master_path)
    webp_width, webp_height = webp_dimensions(beauty_path)
    if (master_width, master_height, master_depth) != (WIDTH, HEIGHT, 16):
        fail("MASTER_INTEGRITY_FAILED", "Master PNG dimensions or bit depth drifted")
    if (webp_width, webp_height) != (WIDTH, HEIGHT):
        fail("WEBP_INTEGRITY_FAILED", "Published WebP dimensions drifted")

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)
    result = {
        "kind": "jq-photoreal-preview-matrix-render-result",
        "schemaVersion": 1,
        "pipelineVersion": PIPELINE_VERSION,
        "status": "succeeded",
        "key": package["identity"]["key"],
        "packageKey": package["packageKey"],
        "authority": {
            "customerMaterialApproved": False,
            "customerBeautyRenderApproved": False,
        },
        "runtime": {
            "blenderVersion": bpy.app.version_string,
            "blenderBuildHash": bpy.app.build_hash.decode("utf-8") if isinstance(bpy.app.build_hash, bytes) else str(bpy.app.build_hash),
            **runtime,
        },
        "counts": {
            "components": len(validated["descriptors"]),
            "submeshes": validated["submeshCount"],
            "productObjects": len(product_objects),
            "roomObjects": len(room_objects),
            "lights": len(light_objects),
            "cameras": 1,
        },
        "outputs": [
            output_record(master_path, "master", "image/png", master_width, master_height, master_depth),
            output_record(beauty_path, "published-preview", "image/webp", webp_width, webp_height),
        ],
    }
    write_json(result_path, result)
    return result


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", required=True)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--project-root")
    parser.add_argument("--output-dir")
    parser.add_argument("--master")
    parser.add_argument("--beauty")
    parser.add_argument("--result")
    parser.add_argument("--blend")
    args = parser.parse_args(argv)
    if not args.validate_only and any(getattr(args, key) is None for key in ("project_root", "output_dir", "master", "beauty", "result", "blend")):
        parser.error("render mode requires --project-root, --output-dir, --master, --beauty, --result, and --blend")
    return args


def main(argv: list[str] | None = None) -> int:
    raw_arguments = sys.argv if argv is None else argv
    worker_arguments = (
        raw_arguments[raw_arguments.index("--") + 1:]
        if "--" in raw_arguments
        else raw_arguments[1:]
    )
    args = parse_args(worker_arguments)
    try:
        package = read_package(Path(args.package).resolve())
        validated = validate_package(package)
        if args.validate_only:
            print(json.dumps({
                "valid": True,
                "key": package["identity"]["key"],
                "packageKey": package["packageKey"],
                "components": len(validated["descriptors"]),
                "submeshes": validated["submeshCount"],
            }, sort_keys=True))
            return 0
        result = run_worker(args, package, validated)
        print(json.dumps({"status": result["status"], "key": result["key"]}, sort_keys=True))
        return 0
    except MatrixWorkerError as error:
        print(json.dumps({"status": "failed", "code": error.code, "message": str(error)}, sort_keys=True), file=sys.stderr)
        return 2
    except Exception as error:  # pragma: no cover - Blender integration guard
        print(json.dumps({
            "status": "failed",
            "code": "UNEXPECTED_MATRIX_WORKER_ERROR",
            "message": str(error),
            "traceback": traceback.format_exc(),
        }, sort_keys=True), file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
