import { test, expect } from "@playwright/test";
import {
  PRODUCT_CHOICES,
  PRODUCT_INTEGRATED_PREVIEW_ASSETS,
  SHARED_ROOM_LAYOUTS,
  resolvePreviewPresentation
} from "../guided-configurator-data.js";

const products = [
  { id: "cabinet-shelves", label: "Cabinets + Shelves", category: "bookcase", style: "cabinet-base-shelves" },
  { id: "drawer-shelves", label: "Drawers + Shelves", category: "bookcase", style: "drawer-base-shelves" },
  { id: "open-shelving", label: "Full Open Shelving", category: "bookcase", style: "full-open-shelving" },
  { id: "tv-unit", label: "TV Unit", category: "tv-unit", style: "framed-tv-wall" },
  { id: "floating-storage", label: "Floating Storage", category: "floating-storage", style: "floating-drawer-bank" },
  { id: "window-storage", label: "Window Storage", category: "window-storage", style: "window-seat-storage" },
  { id: "radiator-cover", label: "Radiator Cover", category: "radiator-cover", style: "clean-slat-cover" }
];

const sharedLayouts = [
  { id: "niche-layout", label: "Niche Layout" },
  { id: "left-niche", label: "Left Niche" },
  { id: "right-niche", label: "Right Niche" },
  { id: "clear-wall", label: "Clear Wall" },
  { id: "fireplace-wall", label: "Fireplace Wall" },
  { id: "center-recess", label: "Center Projection" },
  { id: "window-wall", label: "Window Wall" },
  { id: "door-wall", label: "Door Wall" },
  { id: "corner-wall", label: "Corner Wall" },
  { id: "double-opening", label: "Between Openings" }
];

const visibleMeasurementDimensions = Object.freeze(["wallWidth", "ceilingHeight"]);

function monitorRuntime(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/quote")) {
      failures.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return failures;
}

async function openFreshProject(page) {
  await page.goto("/configurator.html?start=new", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "What would you like us to build?" })).toBeVisible();
  await expect(page).toHaveURL(/configurator\.html#step-1$/);
}

async function chooseProduct(page, label = "Cabinets + Shelves") {
  const product = products.find((candidate) => candidate.label === label);
  if (!product) throw new Error(`Unknown product: ${label}`);
  const card = page.locator(`[data-product-choice="${product.id}"]`);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
}

async function continueToLayouts(page, product = "Cabinets + Shelves") {
  await chooseProduct(page, product);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
  await expect(page).toHaveURL(/configurator\.html#step-2$/);
}

async function chooseLayout(page, label) {
  const card = page.getByRole("button", { name: label, exact: true });
  const layoutId = await card.getAttribute("data-layout");
  await card.click();
  await expect(page.locator(`[data-layout="${layoutId}"]`)).toHaveAttribute("aria-pressed", "true");
}

async function expectIntegratedPreview(preview, expectedAsset) {
  await expect(preview).toHaveAttribute("data-preview-render-mode", "integrated");
  await expect(preview).toHaveAttribute("data-preview-asset", expectedAsset);
  await expect(preview).toHaveAttribute("data-media-fit", "cover");
  await expect(preview).toHaveAttribute(
    "data-authored-layout",
    await preview.getAttribute("data-layout")
  );
  expect(
    await preview.evaluate((element) => (
      ["data-room-asset", "data-product-asset"]
        .filter((attribute) => element.hasAttribute(attribute))
    ))
  ).toEqual([]);
  await expect(preview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
  await expect(
    preview.locator("[data-installation-envelope], [data-installation-envelope-id]")
  ).toHaveCount(0);

  const picture = preview.locator("picture.concept-photo");
  await expect(picture).toHaveCount(1);
  await expect(picture).toBeVisible();
  const image = picture.locator("img");
  await expect(image).toHaveCount(1);
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS("object-fit", "cover");
  await expect.poll(() => image.evaluate((element, asset) => (
    element.complete
      && element.naturalWidth > 0
      && element.naturalHeight > 0
      && new URL(element.currentSrc).pathname.endsWith(asset.replace(/\.png$/, ".avif"))
  ), expectedAsset)).toBe(true);
  const finishOverlay = preview.locator("svg.concept-finish-overlay");
  await expect(finishOverlay).toBeVisible();
  await expect(finishOverlay).toHaveAttribute(
    "preserveAspectRatio",
    /^x(?:Min|Mid|Max)Y(?:Min|Mid|Max) slice$/
  );

  const media = await preview.evaluate((element) => {
    const tolerance = 1;
    const scene = element.querySelector("[data-concept-scene]");
    const pictureElement = scene.querySelector(":scope > picture.concept-photo");
    const imageElement = pictureElement.querySelector(":scope > img.concept-photo");
    const overlay = scene.querySelector(":scope > svg.concept-finish-overlay");
    const sceneRect = scene.getBoundingClientRect();
    const pictureRect = pictureElement.getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const imageStyle = getComputedStyle(imageElement);
    const sceneStyle = getComputedStyle(scene);
    const pictureStyle = getComputedStyle(pictureElement);
    const overlayViewBox = overlay.viewBox.baseVal;
    const scale = Math.max(
      sceneRect.width / imageElement.naturalWidth,
      sceneRect.height / imageElement.naturalHeight
    );
    const paintedWidth = imageElement.naturalWidth * scale;
    const paintedHeight = imageElement.naturalHeight * scale;
    const objectPosition = imageStyle.objectPosition
      .split(" ")
      .map((value) => Number.parseFloat(value));
    const expectedAlignment = `${objectPosition[0] === 0 ? "xMin" : objectPosition[0] === 100 ? "xMax" : "xMid"}${objectPosition[1] === 0 ? "YMin" : objectPosition[1] === 100 ? "YMax" : "YMid"} slice`;
    const sameRect = (first, second) => (
      Math.abs(first.left - second.left) <= tolerance
      && Math.abs(first.top - second.top) <= tolerance
      && Math.abs(first.right - second.right) <= tolerance
      && Math.abs(first.bottom - second.bottom) <= tolerance
    );
    const maskImage = overlay.querySelector("mask image");
    return {
      objectFit: imageStyle.objectFit,
      objectPosition: imageStyle.objectPosition,
      declaredPosition: element.dataset.mediaPosition,
      preserveAspectRatio: overlay.getAttribute("preserveAspectRatio"),
      expectedAlignment,
      naturalWidth: imageElement.naturalWidth,
      naturalHeight: imageElement.naturalHeight,
      declaredWidth: Number(scene.dataset.mediaWidth),
      declaredHeight: Number(scene.dataset.mediaHeight),
      paintedWidth,
      paintedHeight,
      viewportWidth: sceneRect.width,
      viewportHeight: sceneRect.height,
      photoFillsScene: sameRect(imageRect, sceneRect) && sameRect(pictureRect, sceneRect),
      overlayFillsScene: sameRect(overlayRect, sceneRect),
      overlayMatchesSource: (
        Math.abs(overlayViewBox.width - imageElement.naturalWidth) <= tolerance
        && Math.abs(overlayViewBox.height - imageElement.naturalHeight) <= tolerance
      ),
      maskMatchesSource: !maskImage || (
        Number(maskImage.getAttribute("width")) === imageElement.naturalWidth
        && Number(maskImage.getAttribute("height")) === imageElement.naturalHeight
      ),
      mediaHasNoInset: (
        Number.parseFloat(sceneStyle.paddingLeft) === 0
        && Number.parseFloat(sceneStyle.paddingRight) === 0
        && Number.parseFloat(sceneStyle.paddingTop) === 0
        && Number.parseFloat(sceneStyle.paddingBottom) === 0
        && Number.parseFloat(pictureStyle.paddingLeft) === 0
        && Number.parseFloat(pictureStyle.paddingRight) === 0
        && Number.parseFloat(pictureStyle.paddingTop) === 0
        && Number.parseFloat(pictureStyle.paddingBottom) === 0
      )
    };
  });

  expect(media.objectFit).toBe("cover");
  expect(media.objectPosition).toBe(media.declaredPosition);
  expect(media.preserveAspectRatio).toBe(media.expectedAlignment);
  expect(media.naturalWidth).toBe(media.declaredWidth);
  expect(media.naturalHeight).toBe(media.declaredHeight);
  expect(media.paintedWidth).toBeGreaterThanOrEqual(media.viewportWidth - 0.5);
  expect(media.paintedHeight).toBeGreaterThanOrEqual(media.viewportHeight - 0.5);
  expect(media.photoFillsScene).toBe(true);
  expect(media.overlayFillsScene).toBe(true);
  expect(media.overlayMatchesSource).toBe(true);
  expect(media.maskMatchesSource).toBe(true);
  expect(media.mediaHasNoInset).toBe(true);
  return image;
}

async function expectRoomPlusFurniturePreview(preview, presentation, expectedRoomAsset = null) {
  await expect(preview).toHaveAttribute("data-preview-render-mode", "room-plus-furniture");
  await expect(preview).toHaveAttribute("data-preview-asset", presentation.roomAsset);
  await expect(preview).toHaveAttribute("data-room-asset", presentation.roomAsset);
  await expect(preview).toHaveAttribute("data-furniture-asset", presentation.furnitureAsset);
  await expect(preview).toHaveAttribute("data-authored-layout", presentation.layoutId);
  await expect(preview).toHaveAttribute("data-media-fit", "cover");
  if (expectedRoomAsset) {
    expect(presentation.roomAsset).toBe(expectedRoomAsset);
  }

  const roomPicture = preview.locator("picture.concept-room-photo");
  const roomImage = roomPicture.locator("img.concept-room-photo");
  const furnitureImage = preview.locator("img.concept-furniture-photo");
  const finishOverlay = preview.locator("svg.concept-finish-overlay");
  await expect(roomPicture).toHaveCount(1);
  await expect(roomImage).toHaveCount(1);
  await expect(furnitureImage).toHaveCount(1);
  await expect(roomImage).toBeVisible();
  await expect(furnitureImage).toBeVisible();
  await expect(finishOverlay).toBeVisible();
  await expect(roomImage).toHaveCSS("object-fit", "cover");
  await expect(furnitureImage).toHaveCSS("object-fit", "cover");
  await expect(finishOverlay).toHaveAttribute("preserveAspectRatio", "xMidYMid slice");
  await expect.poll(() => roomImage.evaluate((image, asset) => (
    image.complete
      && image.naturalWidth === 1536
      && image.naturalHeight === 1024
      && new URL(image.currentSrc).pathname.endsWith(asset.replace(/\.png$/, ".avif"))
  ), presentation.roomAsset)).toBe(true);
  await expect.poll(() => furnitureImage.evaluate((image, asset) => (
    image.complete
      && image.naturalWidth === 1536
      && image.naturalHeight === 1024
      && new URL(image.currentSrc).pathname.endsWith(asset)
  ), presentation.furnitureAsset)).toBe(true);

  const media = await preview.evaluate(async (element, contract) => {
    const tolerance = 1;
    const scene = element.querySelector("[data-concept-scene]");
    const roomPictureElement = scene.querySelector(":scope > picture.concept-room-photo");
    const roomImageElement = roomPictureElement.querySelector(":scope > img.concept-room-photo");
    const furnitureImageElement = scene.querySelector(":scope > img.concept-furniture-photo");
    const overlay = scene.querySelector(":scope > svg.concept-finish-overlay");
    const sceneRect = scene.getBoundingClientRect();
    const roomPictureRect = roomPictureElement.getBoundingClientRect();
    const roomRect = roomImageElement.getBoundingClientRect();
    const furnitureRect = furnitureImageElement.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const roomStyle = getComputedStyle(roomImageElement);
    const furnitureStyle = getComputedStyle(furnitureImageElement);
    const sameRect = (first, second) => (
      Math.abs(first.left - second.left) <= tolerance
      && Math.abs(first.top - second.top) <= tolerance
      && Math.abs(first.right - second.right) <= tolerance
      && Math.abs(first.bottom - second.bottom) <= tolerance
    );

    const canvas = document.createElement("canvas");
    canvas.width = furnitureImageElement.naturalWidth;
    canvas.height = furnitureImageElement.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(furnitureImageElement, 0, 0);
    const furniturePixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

    const maskImage = new Image();
    maskImage.src = new URL(contract.finishMaskAsset, window.location.href).href;
    await maskImage.decode();
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
    maskContext.drawImage(maskImage, 0, 0);
    const maskPixels = maskContext.getImageData(0, 0, canvas.width, canvas.height).data;

    const envelope = contract.installationEnvelope;
    const minX = envelope.x * canvas.width - 2;
    const minY = envelope.y * canvas.height - 2;
    const maxX = (envelope.x + envelope.width) * canvas.width + 2;
    const maxY = (envelope.y + envelope.height) * canvas.height + 2;
    let opaqueSamples = 0;
    let transparentSamples = 0;
    let opaqueOutsideEnvelope = 0;
    let maskOutsideFurniture = 0;
    let alphaMinX = canvas.width;
    let alphaMinY = canvas.height;
    let alphaMaxX = -1;
    let alphaMaxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const alpha = furniturePixels[offset + 3];
        const maskLuminance = Math.max(
          maskPixels[offset],
          maskPixels[offset + 1],
          maskPixels[offset + 2]
        );
        if (alpha >= 224) opaqueSamples += 1;
        if (alpha <= 8) transparentSamples += 1;
        if (alpha > 8) {
          alphaMinX = Math.min(alphaMinX, x);
          alphaMinY = Math.min(alphaMinY, y);
          alphaMaxX = Math.max(alphaMaxX, x);
          alphaMaxY = Math.max(alphaMaxY, y);
        }
        if (
          alpha > 16
          && (x < minX || x > maxX || y < minY || y > maxY)
        ) {
          opaqueOutsideEnvelope += 1;
        }
        if (maskLuminance > 0 && alpha === 0) maskOutsideFurniture += 1;
      }
    }

    const roomScale = Math.max(
      sceneRect.width / roomImageElement.naturalWidth,
      sceneRect.height / roomImageElement.naturalHeight
    );
    const furnitureScale = Math.max(
      sceneRect.width / furnitureImageElement.naturalWidth,
      sceneRect.height / furnitureImageElement.naturalHeight
    );
    const alphaBounds = {
      left: alphaMinX,
      top: alphaMinY,
      right: alphaMaxX + 1,
      bottom: alphaMaxY + 1,
      width: alphaMaxX - alphaMinX + 1,
      height: alphaMaxY - alphaMinY + 1
    };
    const clearWallPlane = {
      leftX: 0.0755 * canvas.width,
      rightX: 0.9245 * canvas.width,
      ceilingY: 0.102 * canvas.height,
      floorY: 0.67 * canvas.height
    };
    return {
      roomAsset: element.dataset.roomAsset,
      furnitureAsset: element.dataset.furnitureAsset,
      roomObjectFit: roomStyle.objectFit,
      furnitureObjectFit: furnitureStyle.objectFit,
      roomObjectPosition: roomStyle.objectPosition,
      furnitureObjectPosition: furnitureStyle.objectPosition,
      layersShareViewport: (
        sameRect(sceneRect, roomPictureRect)
        && sameRect(sceneRect, roomRect)
        && sameRect(sceneRect, furnitureRect)
        && sameRect(sceneRect, overlayRect)
      ),
      roomPaintedWidth: roomImageElement.naturalWidth * roomScale,
      roomPaintedHeight: roomImageElement.naturalHeight * roomScale,
      furniturePaintedWidth: furnitureImageElement.naturalWidth * furnitureScale,
      furniturePaintedHeight: furnitureImageElement.naturalHeight * furnitureScale,
      viewportWidth: sceneRect.width,
      viewportHeight: sceneRect.height,
      cornersTransparent: [
        3,
        (canvas.width - 1) * 4 + 3,
        ((canvas.height - 1) * canvas.width) * 4 + 3,
        ((canvas.height * canvas.width) - 1) * 4 + 3
      ].every((offset) => furniturePixels[offset] === 0),
      opaqueSamples,
      transparentSamples,
      opaqueOutsideEnvelope,
      maskOutsideFurniture,
      alphaBounds,
      clearWallPlane,
      crownGap: alphaBounds.top - clearWallPlane.ceilingY,
      frontBaseProjection: alphaBounds.bottom - 1 - clearWallPlane.floorY,
      installedHeightRatio: alphaBounds.height / (
        clearWallPlane.floorY - clearWallPlane.ceilingY
      ),
      installedWallOccupancy: alphaBounds.width / (
        clearWallPlane.rightX - clearWallPlane.leftX
      ),
      maskWidth: maskImage.naturalWidth,
      maskHeight: maskImage.naturalHeight
    };
  }, presentation);

  expect(media.roomAsset).toBe(presentation.roomAsset);
  expect(media.furnitureAsset).toBe(presentation.furnitureAsset);
  expect(media.roomObjectFit).toBe("cover");
  expect(media.furnitureObjectFit).toBe("cover");
  expect(media.roomObjectPosition).toBe(media.furnitureObjectPosition);
  expect(media.layersShareViewport).toBe(true);
  expect(media.roomPaintedWidth).toBeGreaterThanOrEqual(media.viewportWidth - 0.5);
  expect(media.roomPaintedHeight).toBeGreaterThanOrEqual(media.viewportHeight - 0.5);
  expect(media.furniturePaintedWidth).toBeGreaterThanOrEqual(media.viewportWidth - 0.5);
  expect(media.furniturePaintedHeight).toBeGreaterThanOrEqual(media.viewportHeight - 0.5);
  expect(media.cornersTransparent).toBe(true);
  expect(media.opaqueSamples).toBeGreaterThan(10_000);
  expect(media.transparentSamples).toBeGreaterThan(10_000);
  expect(media.opaqueOutsideEnvelope).toBe(0);
  expect(media.maskOutsideFurniture).toBe(0);
  expect(
    media.installedWallOccupancy,
    "Clear Wall furniture occupies an intentional share of the rear wall"
  ).toBeGreaterThanOrEqual(0.53);
  expect(
    media.installedWallOccupancy,
    "Clear Wall furniture leaves the room condition legible around the installation"
  ).toBeLessThanOrEqual(0.68);
  expect(
    Math.abs((media.alphaBounds.left + media.alphaBounds.right) / 2 - media.maskWidth / 2),
    "Clear Wall millwork remains centered on the back wall"
  ).toBeLessThanOrEqual(2);
  expect(
    media.crownGap,
    "Clear Wall crown starts at the rear-wall ceiling plane"
  ).toBeGreaterThanOrEqual(-0.008 * media.maskHeight);
  expect(
    media.crownGap,
    "Clear Wall crown stays close to the rear-wall ceiling plane"
  ).toBeLessThanOrEqual(0.012 * media.maskHeight);
  expect(
    media.frontBaseProjection,
    "Clear Wall base reaches the floor/wall contact"
  ).toBeGreaterThanOrEqual(0);
  expect(
    media.frontBaseProjection,
    "Clear Wall base has only a shallow built-in projection beyond the rear wall"
  ).toBeLessThanOrEqual(0.03 * media.maskHeight);
  expect(
    media.installedHeightRatio,
    "Clear Wall furniture height matches the available back-wall plane"
  ).toBeGreaterThanOrEqual(0.95);
  expect(
    media.installedHeightRatio,
    "Clear Wall furniture does not project toward the camera"
  ).toBeLessThanOrEqual(1.06);
  expect(media.maskWidth).toBe(1536);
  expect(media.maskHeight).toBe(1024);
  return { roomImage, furnitureImage, media };
}

async function readConceptImageGeometry(image) {
  return image.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      currentSrc: element.currentSrc,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition
    };
  });
}

async function expectNoHorizontalOverflow(page, selectors) {
  const report = await page.evaluate((targets) => ({
    viewportWidth: window.innerWidth,
    documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
    elements: targets.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const rect = element.getBoundingClientRect();
      return {
        selector,
        missing: false,
        left: rect.left,
        right: rect.right
      };
    })
  }), selectors);

  expect(report.documentOverflow).toBeLessThanOrEqual(1);
  for (const element of report.elements) {
    expect(element.missing, element.selector).toBe(false);
    expect(element.left, `${element.selector} left`).toBeGreaterThanOrEqual(-1);
    expect(element.right, `${element.selector} right`).toBeLessThanOrEqual(report.viewportWidth + 1);
  }
}

async function expectOneScreenWorkspace(page, selectors, context) {
  const report = await page.evaluate((targets) => {
    const isRendered = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0
      );
    };
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      verticalOverflow: document.documentElement.scrollHeight - window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      groups: targets.map((selector) => ({
        selector,
        elements: [...document.querySelectorAll(selector)]
          .filter(isRendered)
          .map((element, index) => {
            const rect = element.getBoundingClientRect();
            return {
              index,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height
            };
          })
      }))
    };
  }, selectors);

  expect(report.horizontalOverflow, `${context} horizontal document overflow`).toBeLessThanOrEqual(1);
  expect(report.verticalOverflow, `${context} vertical document overflow`).toBeLessThanOrEqual(1);
  expect(report.scrollX, `${context} horizontal scroll position`).toBe(0);
  expect(report.scrollY, `${context} vertical scroll position`).toBe(0);
  for (const group of report.groups) {
    expect(group.elements.length, `${context} ${group.selector} rendered`).toBeGreaterThan(0);
    for (const element of group.elements) {
      const label = `${context} ${group.selector}[${element.index}]`;
      expect(element.left, `${label} left`).toBeGreaterThanOrEqual(-1);
      expect(element.right, `${label} right`).toBeLessThanOrEqual(report.viewportWidth + 1);
      expect(element.top, `${label} top`).toBeGreaterThanOrEqual(-1);
      expect(element.bottom, `${label} bottom`).toBeLessThanOrEqual(report.viewportHeight + 1);
    }
  }
  return report;
}

async function expectMeasurementWorkspaceInOneScreen(page, context) {
  const report = await expectOneScreenWorkspace(page, [
    ".guided-header",
    ".guided-stepper",
    ".guided-content-head",
    ".measurement-panel",
    ".measurement-panel [data-measurement-row]",
    ".measurement-panel [data-measurement]",
    ".guided-info",
    ".guided-actions",
    ".guided-actions .guided-button",
    ".measurement-diagram-card"
  ], context);

  const geometry = await page.evaluate(() => {
    const panelElement = document.querySelector(".measurement-panel");
    const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
    const panel = panelElement.getBoundingClientRect();
    const information = rect(".guided-info");
    const actions = rect(".guided-actions");
    const diagram = rect(".measurement-diagram-card");
    const overlap = (first, second) => (
      first.left < second.right - 1
      && first.right > second.left + 1
      && first.top < second.bottom - 1
      && first.bottom > second.top + 1
    );
    return {
      panelBeforeInformation: panel.bottom <= information.top + 1,
      informationBeforeActions: information.bottom <= actions.top + 1,
      controlsClearDiagram: (
        !overlap(panel, diagram)
        && !overlap(information, diagram)
        && !overlap(actions, diagram)
      ),
      panelHasNoClippedOverflow: panelElement.scrollHeight <= panelElement.clientHeight + 1,
      fieldsInsidePanel: [
        ...panelElement.querySelectorAll("[data-measurement-row], .measurement-input-wrap")
      ].every((element) => {
        const elementRect = element.getBoundingClientRect();
        return (
          elementRect.left >= panel.left - 1
          && elementRect.right <= panel.right + 1
          && elementRect.top >= panel.top - 1
          && elementRect.bottom <= panel.bottom + 1
        );
      }),
      diagramRatio: diagram.width / diagram.height,
      buttonHeights: [...document.querySelectorAll(".guided-actions .guided-button")]
        .map((button) => button.getBoundingClientRect().height),
      controlHeights: [...document.querySelectorAll(
        '.measurement-panel input:not([type="radio"]), .measurement-panel select, .measurement-panel .measurement-toggle'
      )]
        .filter((control) => getComputedStyle(control).display !== "none")
        .map((control) => control.getBoundingClientRect().height)
    };
  });

  expect(geometry.panelBeforeInformation, `${context} panel precedes note`).toBe(true);
  expect(geometry.informationBeforeActions, `${context} note precedes actions`).toBe(true);
  expect(geometry.controlsClearDiagram, `${context} controls do not overlap diagram`).toBe(true);
  expect(geometry.panelHasNoClippedOverflow, `${context} panel has no clipped fields`).toBe(true);
  expect(geometry.fieldsInsidePanel, `${context} fields stay inside panel`).toBe(true);
  expect(geometry.diagramRatio, `${context} height-first diagram ratio`).toBeCloseTo(4 / 3, 2);
  expect(Math.min(...geometry.buttonHeights), `${context} action target height`).toBeGreaterThanOrEqual(43);
  expect(Math.min(...geometry.controlHeights), `${context} measurement control height`).toBeGreaterThanOrEqual(35);
  return report;
}

async function expectCustomizationWorkspaceInOneScreen(page, context) {
  return expectOneScreenWorkspace(page, [
    ".guided-header",
    ".guided-stepper",
    ".guided-content-head",
    ".customization-panel",
    ".customization-actions",
    ".customization-actions .guided-button",
    ".concept-preview",
    ".concept-preview-meta",
    ".concept-scene",
    ".preview-controls"
  ], context);
}

async function expectDrawersRightNicheComposition(preview, context) {
  const conceptAsset = "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/right-niche-v2.png";
  const finishMaskAsset = "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/right-niche-finish-mask-v2.png";
  await expectIntegratedPreview(preview, conceptAsset);
  await expect(preview).toHaveAttribute("data-preview-key", "bookcase:drawer-base-shelves:right-niche");
  await expect(preview).toHaveAttribute("data-authored-layout", "right-niche");
  const layoutContext = preview.locator('[data-layout-context="right-niche"]');
  await expect(layoutContext).toBeVisible();
  await expect(layoutContext).toHaveAccessibleName("Selected room condition: Right Niche");
  const maskElement = preview.locator("svg.concept-finish-overlay mask image");
  await expect(maskElement).toHaveCount(1);
  await expect(maskElement).toHaveAttribute("href", finishMaskAsset);

  const geometry = await preview.evaluate(async (element, expectedMaskAsset) => {
    const scene = element.querySelector("[data-concept-scene]");
    const image = scene.querySelector("img.concept-photo");
    const overlay = scene.querySelector("svg.concept-finish-overlay");
    const maskNode = overlay.querySelector("mask image");
    const sceneRect = scene.getBoundingClientRect();
    const imageStyle = getComputedStyle(image);
    const objectPosition = imageStyle.objectPosition
      .split(" ")
      .map((value) => Number.parseFloat(value) / 100);
    const maskImage = new Image();
    maskImage.src = new URL(maskNode.getAttribute("href"), window.location.href).href;
    await maskImage.decode();
    const canvas = document.createElement("canvas");
    canvas.width = maskImage.naturalWidth;
    canvas.height = maskImage.naturalHeight;
    const context2d = canvas.getContext("2d", { willReadFrequently: true });
    context2d.drawImage(maskImage, 0, 0);
    const pixels = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    let nonzeroPixels = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const luminance = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
        if (luminance <= 8 || pixels[offset + 3] <= 8) continue;
        nonzeroPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const sourceBounds = {
      left: minX,
      top: minY,
      right: maxX + 1,
      bottom: maxY + 1,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
    const coverScale = Math.max(
      sceneRect.width / image.naturalWidth,
      sceneRect.height / image.naturalHeight
    );
    const paintedWidth = image.naturalWidth * coverScale;
    const paintedHeight = image.naturalHeight * coverScale;
    const paintedLeft = sceneRect.left - (paintedWidth - sceneRect.width) * objectPosition[0];
    const paintedTop = sceneRect.top - (paintedHeight - sceneRect.height) * objectPosition[1];
    const paintedBounds = {
      left: paintedLeft + sourceBounds.left * coverScale,
      top: paintedTop + sourceBounds.top * coverScale,
      right: paintedLeft + sourceBounds.right * coverScale,
      bottom: paintedTop + sourceBounds.bottom * coverScale
    };
    return {
      maskAsset: maskNode.getAttribute("href"),
      sourceWidth: canvas.width,
      sourceHeight: canvas.height,
      nonzeroPixels,
      sourceBounds,
      sourceMargins: {
        left: sourceBounds.left,
        top: sourceBounds.top,
        right: canvas.width - sourceBounds.right,
        bottom: canvas.height - sourceBounds.bottom
      },
      paintedMargins: {
        left: paintedBounds.left - sceneRect.left,
        top: paintedBounds.top - sceneRect.top,
        right: sceneRect.right - paintedBounds.right,
        bottom: sceneRect.bottom - paintedBounds.bottom
      },
      fullyVisible: (
        paintedBounds.left >= sceneRect.left - 1
        && paintedBounds.top >= sceneRect.top - 1
        && paintedBounds.right <= sceneRect.right + 1
        && paintedBounds.bottom <= sceneRect.bottom + 1
      ),
      resetScale: Number.parseFloat(getComputedStyle(scene).getPropertyValue("--preview-scale")) || 1,
      expectedMaskUrlMatches: new URL(maskImage.src).pathname.endsWith(expectedMaskAsset)
    };
  }, finishMaskAsset);

  expect(geometry.maskAsset, `${context} mask asset`).toBe(finishMaskAsset);
  expect(geometry.expectedMaskUrlMatches, `${context} decoded mask asset`).toBe(true);
  expect([geometry.sourceWidth, geometry.sourceHeight], `${context} authored dimensions`).toEqual([1536, 1024]);
  expect(geometry.nonzeroPixels, `${context} useful furniture mask`).toBeGreaterThan(100_000);
  expect(geometry.sourceBounds, `${context} complete authored furniture bounds`).toEqual({
    left: 338,
    top: 136,
    right: 1199,
    bottom: 856,
    width: 861,
    height: 720
  });
  expect(geometry.sourceBounds.width / geometry.sourceWidth, `${context} furniture width`).toBeGreaterThan(0.5);
  expect(geometry.sourceBounds.height / geometry.sourceHeight, `${context} furniture height`).toBeGreaterThan(0.65);
  expect(geometry.sourceMargins.left, `${context} complete left side`).toBeGreaterThanOrEqual(0.18 * geometry.sourceWidth);
  expect(geometry.sourceMargins.right, `${context} complete right side`).toBeGreaterThanOrEqual(0.18 * geometry.sourceWidth);
  expect(geometry.sourceMargins.top, `${context} crown and wall above`).toBeGreaterThanOrEqual(0.1 * geometry.sourceHeight);
  expect(geometry.sourceMargins.bottom, `${context} base and floor below`).toBeGreaterThanOrEqual(0.14 * geometry.sourceHeight);
  expect(geometry.fullyVisible, `${context} complete furniture survives the active cover crop`).toBe(true);
  for (const [side, margin] of Object.entries(geometry.paintedMargins)) {
    expect(margin, `${context} visible ${side} breathing room`).toBeGreaterThanOrEqual(8);
  }
  expect(geometry.resetScale, `${context} semantic crop is measured at reset`).toBe(1);
  return geometry;
}

async function continueToReview(page, layout = "Clear Wall", product = "Cabinets + Shelves") {
  await continueToLayouts(page, product);
  await chooseLayout(page, layout);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
}

async function fillQuoteContact(page) {
  const dialog = page.locator("[data-quote-dialog]");
  const contact = {
    fullName: "Alex Morgan",
    email: "alex@example.com",
    phone: "5165550188",
    zip: "11570"
  };
  for (const [name, value] of Object.entries(contact)) {
    const field = dialog.locator(`input[name="${name}"]`);
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }
  return dialog;
}

async function serveWithQuoteEndpoint(page, status, body) {
  await page.route("**/configurator.html*", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      '<meta name="jq-quote-endpoint" content="">',
      '<meta name="jq-quote-endpoint" content="/api/quote">'
    );
    await route.fulfill({
      response,
      body: html,
      headers: { ...response.headers(), "content-type": "text/html; charset=utf-8" }
    });
  });
  await page.route("**/api/quote", (route) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  }));
}

test("public route is the lightweight five-step configurator and excludes the 3D engine", async ({ page }) => {
  const runtime = monitorRuntime(page);
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await openFreshProject(page);

  await expect(page.locator("[data-guided-app]")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Project steps" }).getByRole("button")).toHaveCount(5);
  await expect(page.locator(".guided-category-nav")).toHaveCount(0);
  await expect(page.locator("[data-product-choice]")).toHaveCount(7);
  await expect(page.locator("[data-product-choice] .product-card-title")).toHaveText([
    "Cabinets + Shelves",
    "Drawers + Shelves",
    "Full Open Shelving",
    "TV Unit",
    "Floating Storage",
    "Window Storage",
    "Radiator Cover"
  ]);
  await expect(page.locator("[data-product-choice] picture source[type='image/avif']")).toHaveCount(7);
  await expect.poll(() => page.locator("[data-product-choice] img").evaluateAll((images) => (
    images.every((image) => image.complete && image.naturalWidth > 0 && image.currentSrc.endsWith(".avif"))
  ))).toBe(true);
  await expect(page.locator("canvas, [data-3d-viewer], model-viewer")).toHaveCount(0);
  expect(requests.some((path) => /configurator-3d|three\.module|cabinet-ar|direct-hardware/i.test(path))).toBe(false);
  expect(runtime).toEqual([]);
});

test("Step 1 product cards use one edge-to-edge 13:10 media format without changing room-card fitting", async ({ page }) => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "iPad landscape", width: 1024, height: 768 },
    { name: "phone", width: 390, height: 844 }
  ]) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFreshProject(page);

      const images = page.locator(".guided-shell--step-1 .product-grid--catalog [data-product-choice] img");
      await expect(images).toHaveCount(products.length);
      await expect.poll(() => images.evaluateAll((elements) => elements.every((image) => (
        image.complete
        && image.naturalWidth > 0
        && image.naturalHeight > 0
        && getComputedStyle(image).objectFit === "cover"
      )))).toBe(true);

      const geometry = await page.locator("[data-product-choice]").evaluateAll((cards) => cards.map((card) => {
        const cardRect = card.getBoundingClientRect();
        const mediaRect = card.querySelector(".product-card-image").getBoundingClientRect();
        const copyRect = card.querySelector(".product-card-copy").getBoundingClientRect();
        const image = card.querySelector("img");
        const imageRect = image.getBoundingClientRect();
        const scale = Math.max(
          mediaRect.width / image.naturalWidth,
          mediaRect.height / image.naturalHeight
        );
        return {
          cardWidth: cardRect.width,
          cardHeight: cardRect.height,
          mediaWidth: mediaRect.width,
          mediaHeight: mediaRect.height,
          copyHeight: copyRect.height,
          imageEdges: {
            left: Math.abs(imageRect.left - mediaRect.left),
            top: Math.abs(imageRect.top - mediaRect.top),
            right: Math.abs(imageRect.right - mediaRect.right),
            bottom: Math.abs(imageRect.bottom - mediaRect.bottom)
          },
          paintedWidth: image.naturalWidth * scale,
          paintedHeight: image.naturalHeight * scale,
          objectPosition: getComputedStyle(image).objectPosition
        };
      }));

      const spread = (values) => Math.max(...values) - Math.min(...values);
      expect(spread(geometry.map(({ cardWidth }) => cardWidth))).toBeLessThanOrEqual(1);
      expect(spread(geometry.map(({ cardHeight }) => cardHeight))).toBeLessThanOrEqual(1);
      expect(spread(geometry.map(({ mediaWidth }) => mediaWidth))).toBeLessThanOrEqual(1);
      expect(spread(geometry.map(({ mediaHeight }) => mediaHeight))).toBeLessThanOrEqual(1);
      expect(spread(geometry.map(({ copyHeight }) => copyHeight))).toBeLessThanOrEqual(1);
      expect(geometry.every(({
        cardWidth,
        cardHeight,
        mediaWidth,
        mediaHeight,
        imageEdges,
        paintedWidth,
        paintedHeight
      }) => (
        cardWidth > 0
        && cardHeight > 0
        && Math.abs(mediaWidth / mediaHeight - 1.3) <= 0.01
        && Math.abs(mediaWidth - cardWidth) <= 2
        && mediaHeight > 0
        && mediaHeight < cardHeight
        && Object.values(imageEdges).every((edge) => edge <= 1)
        && paintedWidth >= mediaWidth - 1
        && paintedHeight >= mediaHeight - 1
      ))).toBe(true);
      expect(geometry.map(({ objectPosition }) => objectPosition)).toEqual([
        "50% 25%",
        "50% 50%",
        "50% 50%",
        "50% 50%",
        "50% 50%",
        "50% 50%",
        "50% 50%"
      ]);
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - window.innerWidth
      ))).toBeLessThanOrEqual(1);
    });
  }

  await continueToLayouts(page);
  const layoutImages = page.locator(".layout-grid .layout-illustration img");
  await expect(layoutImages).toHaveCount(sharedLayouts.length);
  await expect.poll(() => layoutImages.evaluateAll((images) => (
    images.every((image) => getComputedStyle(image).objectFit === "cover")
  ))).toBe(true);
});

test("Step 2 room cards use one edge-to-edge 4:3 media format without selected-state shifts", async ({ page }) => {
  const readGeometry = () => page.locator("[data-layout]").evaluateAll((cards) => cards.map((card) => {
    const cardRect = card.getBoundingClientRect();
    const mediaRect = card.querySelector(".layout-illustration").getBoundingClientRect();
    const image = card.querySelector("img");
    const imageRect = image.getBoundingClientRect();
    const scale = Math.max(
      mediaRect.width / image.naturalWidth,
      mediaRect.height / image.naturalHeight
    );
    return {
      id: card.dataset.layout,
      offsetLeft: card.offsetLeft,
      offsetTop: card.offsetTop,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      mediaWidth: mediaRect.width,
      mediaHeight: mediaRect.height,
      imageEdges: {
        left: Math.abs(imageRect.left - mediaRect.left),
        top: Math.abs(imageRect.top - mediaRect.top),
        right: Math.abs(imageRect.right - mediaRect.right),
        bottom: Math.abs(imageRect.bottom - mediaRect.bottom)
      },
      objectFit: getComputedStyle(image).objectFit,
      visibleWidthFraction: mediaRect.width / (image.naturalWidth * scale),
      visibleHeightFraction: mediaRect.height / (image.naturalHeight * scale)
    };
  }));

  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "iPad landscape", width: 1024, height: 768 }
  ]) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFreshProject(page);
      await continueToLayouts(page);

      const cards = page.locator("[data-layout]");
      const images = cards.locator(".layout-illustration img");
      await expect(cards).toHaveCount(sharedLayouts.length);
      await expect.poll(() => images.evaluateAll((elements) => elements.every((image) => (
        image.complete
        && image.naturalWidth > 0
        && image.naturalHeight > 0
      )))).toBe(true);

      const beforeSelection = await readGeometry();
      const spread = (values) => Math.max(...values) - Math.min(...values);
      expect(beforeSelection.map(({ id }) => id)).toEqual(sharedLayouts.map(({ id }) => id));
      expect(spread(beforeSelection.map(({ cardWidth }) => cardWidth))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.map(({ cardHeight }) => cardHeight))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.map(({ mediaWidth }) => mediaWidth))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.map(({ mediaHeight }) => mediaHeight))).toBeLessThanOrEqual(1);
      expect(beforeSelection.every(({
        mediaWidth,
        mediaHeight,
        imageEdges,
        objectFit,
        visibleWidthFraction,
        visibleHeightFraction
      }) => (
        Math.abs(mediaWidth / mediaHeight - (4 / 3)) <= 0.01
        && Object.values(imageEdges).every((edge) => edge <= 1)
        && objectFit === "cover"
        && visibleWidthFraction >= 0.74
        && visibleHeightFraction >= 0.74
      ))).toBe(true);
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - window.innerWidth
      ))).toBeLessThanOrEqual(1);

      const selectedCard = page.locator('[data-layout="double-opening"]');
      await selectedCard.focus();
      await selectedCard.press("Space");
      await expect(selectedCard).toHaveAttribute("aria-pressed", "true");
      await expect(selectedCard).toHaveCSS("border-left-width", "1px");
      await expect(selectedCard).toHaveCSS("border-right-width", "1px");

      const afterSelection = await readGeometry();
      for (const cardBefore of beforeSelection) {
        const cardAfter = afterSelection.find(({ id }) => id === cardBefore.id);
        for (const property of [
          "offsetLeft",
          "offsetTop",
          "cardWidth",
          "cardHeight",
          "mediaWidth",
          "mediaHeight"
        ]) {
          expect(Math.abs(cardAfter[property] - cardBefore[property])).toBeLessThanOrEqual(1);
        }
      }
    });
  }
});

test("Step 1 centers the three-card bottom row without selected-state geometry shifts", async ({ page }) => {
  const readLayout = () => page.evaluate(() => {
    const grid = document.querySelector(".guided-shell--step-1 .product-grid--catalog");
    const gridRect = grid.getBoundingClientRect();
    const cards = [...grid.querySelectorAll("[data-product-choice]")].map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        id: card.dataset.productChoice,
        left: rect.left - gridRect.left,
        right: rect.right - gridRect.left,
        top: rect.top - gridRect.top,
        width: rect.width,
        height: rect.height
      };
    });
    return {
      gridWidth: gridRect.width,
      columnGap: parseFloat(getComputedStyle(grid).columnGap),
      cards
    };
  });

  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "iPad landscape", width: 1024, height: 768 }
  ]) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFreshProject(page);

      const beforeSelection = await readLayout();
      const topRow = beforeSelection.cards.slice(0, 4);
      const bottomRow = beforeSelection.cards.slice(4);
      const spread = (values) => Math.max(...values) - Math.min(...values);
      const gaps = (cards) => cards.slice(1).map((card, index) => (
        card.left - cards[index].right
      ));

      expect(topRow.map(({ id }) => id)).toEqual([
        "cabinet-shelves",
        "drawer-shelves",
        "open-shelving",
        "tv-unit"
      ]);
      expect(bottomRow.map(({ id }) => id)).toEqual([
        "floating-storage",
        "window-storage",
        "radiator-cover"
      ]);
      expect(spread(topRow.map(({ top }) => top))).toBeLessThanOrEqual(1);
      expect(spread(bottomRow.map(({ top }) => top))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.cards.map(({ width }) => width))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.cards.map(({ height }) => height))).toBeLessThanOrEqual(1);
      expect(topRow[0].left).toBeLessThanOrEqual(1);
      expect(Math.abs(topRow[3].right - beforeSelection.gridWidth)).toBeLessThanOrEqual(1);
      for (const gap of gaps(topRow)) {
        expect(Math.abs(gap - beforeSelection.columnGap)).toBeLessThanOrEqual(1);
      }
      for (const gap of gaps(bottomRow)) {
        expect(Math.abs(gap - beforeSelection.columnGap)).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(bottomRow[0].left - (
        beforeSelection.gridWidth - bottomRow[2].right
      ))).toBeLessThanOrEqual(1);

      const radiator = page.locator('[data-product-choice="radiator-cover"]');
      await radiator.focus();
      await radiator.press("Space");
      await expect(radiator).toHaveAttribute("aria-pressed", "true");
      await expect(radiator).toHaveClass(/is-selected/);
      await expect(radiator).toHaveCSS("border-left-width", "1px");
      await expect(radiator).toHaveCSS("border-right-width", "1px");

      const afterSelection = await readLayout();
      for (const cardBefore of beforeSelection.cards) {
        const cardAfter = afterSelection.cards.find(({ id }) => id === cardBefore.id);
        for (const property of ["left", "right", "top", "width", "height"]) {
          expect(Math.abs(cardAfter[property] - cardBefore[property])).toBeLessThanOrEqual(1);
        }
      }
    });
  }
});

test("wide desktop keeps all seven product cards equal and horizontally contained", async ({ page }) => {
  await page.setViewportSize({ width: 2491, height: 1146 });
  await openFreshProject(page);

  const cards = page.locator("[data-product-choice]");
  await expect(cards).toHaveCount(7);
  await expect.poll(() => cards.locator("img").evaluateAll((images) => (
    images.every((image) => image.complete && image.naturalWidth > 0)
  ))).toBe(true);

  const geometry = await page.evaluate(() => {
    const tolerance = 1;
    const grid = document.querySelector(".product-grid--catalog").getBoundingClientRect();
    const cardReports = [...document.querySelectorAll("[data-product-choice]")].map((card) => {
      const cardRect = bounds(card);
      const imageRect = bounds(card.querySelector(".product-card-image"));
      const titleRect = bounds(card.querySelector(".product-card-title"));
      return {
        card: cardRect,
        image: imageRect,
        title: titleRect,
        insideGrid: (
          cardRect.top >= grid.top - tolerance
          && cardRect.right <= grid.right + tolerance
          && cardRect.bottom <= grid.bottom + tolerance
          && cardRect.left >= grid.left - tolerance
        ),
        noInternalOverflow: (
          card.scrollWidth <= card.clientWidth + tolerance
          && card.scrollHeight <= card.clientHeight + tolerance
        )
      };
    });
    const widths = cardReports.map(({ card }) => card.width);
    const rowTops = cardReports
      .map(({ card }) => card.top)
      .sort((a, b) => a - b)
      .reduce((rows, top) => {
        if (!rows.some((rowTop) => Math.abs(rowTop - top) <= 2)) rows.push(top);
        return rows;
      }, []);
    return {
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      verticalOverflow: document.documentElement.scrollHeight - window.innerHeight,
      widthSpread: Math.max(...widths) - Math.min(...widths),
      rowTops,
      cards: cardReports
    };

    function bounds(element) {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };
    }
  });

  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(geometry.verticalOverflow).toBeGreaterThanOrEqual(0);
  expect(geometry.widthSpread).toBeLessThanOrEqual(2);
  expect(geometry.rowTops).toHaveLength(2);
  for (const [index, card] of geometry.cards.entries()) {
    const label = `product card ${index + 1}`;
    expect(card.insideGrid, `${label} inside grid`).toBe(true);
    expect(card.noInternalOverflow, `${label} internal overflow`).toBe(true);
    expect(card.card.width, `${label} width`).toBeGreaterThanOrEqual(250);
    expect(card.card.height, `${label} height`).toBeGreaterThanOrEqual(180);
    expect(card.image.width, `${label} image width`).toBeGreaterThanOrEqual(240);
    expect(card.title.left, `${label} title left`).toBeGreaterThanOrEqual(card.card.left - 1);
    expect(card.title.right, `${label} title right`).toBeLessThanOrEqual(card.card.right + 1);
  }

  await chooseProduct(page);
  await expect(page.locator("[data-continue]")).toBeEnabled();
  await page.locator("[data-continue]").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-continue]")).toBeVisible();
});

test("Continue requires explicit choices and every product uses the same ten room layouts", async ({ page }) => {
  await openFreshProject(page);
  await expect(page.locator("[data-continue]")).toBeDisabled();

  for (const product of products) {
    await openFreshProject(page);
    await continueToLayouts(page, product.label);
    const cards = page.locator("[data-layout]");
    await expect(cards).toHaveCount(sharedLayouts.length);
    await expect(cards.locator(".layout-card-title")).toHaveText(sharedLayouts.map((layout) => layout.label));
    expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-layout"))))
      .toEqual(sharedLayouts.map((layout) => layout.id));
    await expect(page.locator("[data-continue]")).toBeDisabled();
  }
});

test("measurement fields adapt to the layout, accept fractions, warn gently, and retain values", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Window Wall");
  await page.locator("[data-continue]").click();

  for (const fieldId of [
    "wallWidth",
    "ceilingHeight",
    "desiredDepth",
    "leftReturn",
    "rightReturn",
    "windowWidth",
    "windowHeight",
    "sillHeight",
    "radiatorBelowWindow"
  ]) {
    await expect(page.locator(`[data-measurement-row="${fieldId}"]`)).toBeVisible();
  }

  const width = page.locator('[data-measurement="wallWidth"]');
  await width.fill("121 1/2");
  await expect(page.locator('[data-dimension-chip="wallWidth"]')).toContainText("121 1/2 in");
  await width.fill("190");
  await expect(page.locator('[data-measurement-row="wallWidth"] .measurement-warning')).toContainText("outside our usual");
  const optionalWindowWidth = page.locator('[data-measurement="windowWidth"]');
  await optionalWindowWidth.fill("about four feet");
  await expect(page.locator('[data-measurement-row="windowWidth"] .measurement-input-error')).toContainText("decimal, or a common fraction");
  await expect(optionalWindowWidth).toHaveAttribute("aria-invalid", "");
  await optionalWindowWidth.fill("48");

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await expect(page.locator(".concept-preview")).toHaveAttribute(
    "data-preview-asset",
    "assets/photos/configurator/concept-window-cabinets-v1.png"
  );
  await page.locator("[data-back]").click();
  await expect(width).toHaveValue("190");

  await width.fill("");
  await expect(width).toHaveValue("");
  await page.locator("[data-continue]").click();
  await expect(page.locator("[data-measurement-error]")).toContainText("approximate wall width");
  await expect(width).toBeFocused();
});

test("Between Openings remains visible through customization and review", async ({ page }) => {
  await openFreshProject(page);
  const fullShelving = page.locator('[data-product-choice="open-shelving"]');
  await fullShelving.click();
  await expect(fullShelving).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await chooseLayout(page, "Between Openings");
  await page.locator("[data-continue]").click();

  await expect(page.locator(".selected-layout-chip")).toContainText("Between Openings");
  await expect(page.locator('[data-measurement="openingLeftDistance"]')).toBeVisible();
  await expect(page.locator('[data-measurement="openingRightDistance"]')).toBeVisible();
  await page.locator("[data-continue]").click();

  const customizationPreview = page.locator('.concept-preview[data-layout="double-opening"]');
  const customizationContext = customizationPreview.locator('[data-layout-context="double-opening"]');
  const roomAsset = "assets/photos/configurator/room-layouts/room-double-opening-v1.png";
  const conceptAsset = "assets/photos/configurator/concept-full-shelving-between-openings-v1.png";
  await expectIntegratedPreview(customizationPreview, conceptAsset);
  await expect(customizationContext).toBeVisible();
  await expect(customizationContext).toHaveAccessibleName("Selected room condition: Between Openings");
  await expect(customizationContext).toHaveAttribute("data-layout-context-asset", roomAsset);
  const contextGeometry = await customizationPreview.evaluate((preview) => {
    const previewRect = preview.getBoundingClientRect();
    const metaRect = preview.querySelector(".concept-preview-meta").getBoundingClientRect();
    const sceneRect = preview.querySelector(".concept-scene").getBoundingClientRect();
    const finishRect = preview.querySelector(".concept-finish-caption").getBoundingClientRect();
    const contextRect = preview.querySelector("[data-layout-context]").getBoundingClientRect();
    const pictureRect = preview.querySelector("picture.concept-photo").getBoundingClientRect();
    const overlaps = (first, second) => (
      first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      widthRatio: contextRect.width / previewRect.width,
      heightRatio: contextRect.height / previewRect.height,
      metaBeforeScene: metaRect.bottom <= sceneRect.top + 1,
      contextBeforeScene: contextRect.bottom <= sceneRect.top + 1,
      controlsDoNotOverlap: !overlaps(finishRect, contextRect),
      pictureFillsScene: (
        Math.abs(pictureRect.left - sceneRect.left) <= 1
        && Math.abs(pictureRect.top - sceneRect.top) <= 1
        && Math.abs(pictureRect.right - sceneRect.right) <= 1
        && Math.abs(pictureRect.bottom - sceneRect.bottom) <= 1
      ),
      insidePreview: (
        contextRect.top >= previewRect.top
        && contextRect.right <= previewRect.right
        && contextRect.bottom <= previewRect.bottom
        && contextRect.left >= previewRect.left
      )
    };
  });
  expect(contextGeometry.insidePreview).toBe(true);
  expect(contextGeometry.widthRatio).toBeLessThan(0.5);
  expect(contextGeometry.heightRatio).toBeLessThan(0.12);
  expect(contextGeometry.metaBeforeScene).toBe(true);
  expect(contextGeometry.contextBeforeScene).toBe(true);
  expect(contextGeometry.controlsDoNotOverlap).toBe(true);
  expect(contextGeometry.pictureFillsScene).toBe(true);

  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(customizationContext).toBeVisible();
  await page.locator("[data-continue]").click();

  const reviewPreview = page.locator('.concept-preview[data-layout="double-opening"]');
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Between Openings");
  await expectIntegratedPreview(reviewPreview, conceptAsset);
  await expect(reviewPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(reviewPreview.locator('[data-layout-context="double-opening"]')).toBeVisible();
  await expect(reviewPreview.locator('[data-layout-context="double-opening"]')).toHaveAccessibleName(
    "Selected room condition: Between Openings"
  );
});

test("TV Unit keeps one exact Between Openings composite through customization, review, and reload", async ({ page }) => {
  const conceptAsset = "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v2.png";
  const viewports = [
    { name: "desktop", width: 1180, height: 820 },
    { name: "iPad landscape", width: 1280, height: 720 }
  ];

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFreshProject(page);
      await continueToLayouts(page, "TV Unit");
      await chooseLayout(page, "Between Openings");
      await page.locator("[data-continue]").click();

      const stepThreeRoom = page.locator(
        '.measurement-room[data-layout="double-opening"] img.measurement-room-image'
      );
      await expect(stepThreeRoom).toBeVisible();
      await expect.poll(() => stepThreeRoom.evaluate((image) => (
        image.complete
          && image.naturalWidth > 0
          && /room-double-opening-v1\.(?:avif|png)$/.test(new URL(image.currentSrc).pathname)
      ))).toBe(true);

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();

      const customizationPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expectIntegratedPreview(customizationPreview, conceptAsset);

      const customizationLayers = await customizationPreview.evaluate((preview) => {
        const scene = preview.querySelector("[data-concept-scene]").getBoundingClientRect();
        const picture = preview.querySelector("picture.concept-photo").getBoundingClientRect();
        return {
          pictureFillsScene: (
            Math.abs(picture.left - scene.left) <= 1
            && Math.abs(picture.top - scene.top) <= 1
            && Math.abs(picture.right - scene.right) <= 1
            && Math.abs(picture.bottom - scene.bottom) <= 1
          )
        };
      });
      expect(customizationLayers).toEqual({ pictureFillsScene: true });

      await page.getByRole("button", { name: "Charcoal", exact: true }).click();
      await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
      await page.waitForTimeout(250);
      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
      const reviewPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expectIntegratedPreview(reviewPreview, conceptAsset);

      await page.locator('[data-step="4"]').click();
      await expect(page).toHaveURL(/configurator\.html#step-4$/);
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
      await page.reload({ waitUntil: "networkidle" });
      await expect(page).toHaveURL(/configurator\.html#step-4$/);
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
      const reloadedCustomizationPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expectIntegratedPreview(reloadedCustomizationPreview, conceptAsset);

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
      const reloadedPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expectIntegratedPreview(reloadedPreview, conceptAsset);
    });
  }
});

test("Between Openings keeps every bookcase construction in the selected room", async ({ page }) => {
  const variants = [
    {
      product: "cabinet-shelves",
      style: "cabinet-base-shelves",
      asset: "assets/photos/configurator/concept-cabinets-shelves-between-openings-v1.png"
    },
    {
      product: "drawer-shelves",
      style: "drawer-base-shelves",
      asset: "assets/photos/configurator/concept-drawers-shelves-between-openings-v1.png"
    },
    {
      product: "open-shelving",
      style: "full-open-shelving",
      asset: "assets/photos/configurator/concept-full-shelving-between-openings-v1.png"
    }
  ];

  for (const variant of variants) {
    await openFreshProject(page);
    await page.locator(`[data-product-choice="${variant.product}"]`).click();
    await page.locator("[data-continue]").click();
    await chooseLayout(page, "Between Openings");
    await page.locator("[data-continue]").click();
    await page.locator("[data-continue]").click();

    const preview = page.locator('.concept-preview[data-layout="double-opening"]');
    const image = await expectIntegratedPreview(preview, variant.asset);
    await expect.poll(() => image.evaluate((element) => (
      element.naturalWidth === 1536 && element.naturalHeight === 1024
    ))).toBe(true);
    await expect(preview.locator('[data-layout-context="double-opening"]')).toHaveAccessibleName(
      "Selected room condition: Between Openings"
    );
  }
});

test("Door Wall keeps the selected drawer construction through customization and review", async ({ page }) => {
  const asset = "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/door-wall-v1.png";
  const avifAsset = asset.replace(/\.png$/, ".avif");
  const finishMaskAsset = asset.replace(/-v1\.png$/, "-finish-mask-v1.png");
  let finishMaskStatus = 0;
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith(finishMaskAsset)) {
      finishMaskStatus = response.status();
    }
  });

  await openFreshProject(page);
  await page.locator('[data-product-choice="drawer-shelves"]').click();
  await page.locator("[data-continue]").click();
  await chooseLayout(page, "Door Wall");
  await page.locator("[data-continue]").click();
  await expect(page.locator(".selected-layout-chip")).toContainText("Door Wall");
  await expect(page.locator('[data-measurement="doorWidth"]')).toBeVisible();
  await expect(page.locator('[data-measurement="doorHeight"]')).toBeVisible();
  await expect.poll(() => finishMaskStatus).toBe(200);
  await page.locator("[data-continue]").click();

  const customizationPreview = page.locator('.concept-preview[data-layout="door-wall"]');
  await expect(customizationPreview).toHaveAttribute(
    "data-preview-key",
    "bookcase:drawer-base-shelves:door-wall"
  );
  await expect(customizationPreview).toHaveAttribute("data-style", "drawer-base-shelves");
  const customizationImage = await expectIntegratedPreview(customizationPreview, asset);
  await expect(customizationPreview.locator('[data-layout-context="door-wall"]')).toHaveAccessibleName(
    "Selected room condition: Door Wall"
  );
  await expect.poll(() => customizationImage.evaluate((image, expectedPath) => (
    image.naturalWidth === 1536
      && image.naturalHeight === 1024
      && new URL(image.currentSrc).pathname.endsWith(expectedPath)
  ), avifAsset)).toBe(true);
  const beforeFinish = await readConceptImageGeometry(customizationImage);

  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  const updatedCustomizationImage = await expectIntegratedPreview(customizationPreview, asset);
  const afterFinish = await readConceptImageGeometry(updatedCustomizationImage);
  expect(afterFinish.currentSrc).toBe(beforeFinish.currentSrc);
  expect(afterFinish.naturalWidth).toBe(beforeFinish.naturalWidth);
  expect(afterFinish.naturalHeight).toBe(beforeFinish.naturalHeight);
  expect(afterFinish.objectFit).toBe(beforeFinish.objectFit);
  expect(afterFinish.objectPosition).toBe(beforeFinish.objectPosition);
  // Switching tabs can move the preview within the scrolling page; it must not
  // change the media viewport or the crop inside that viewport.
  for (const key of ["width", "height"]) {
    expect(afterFinish[key], `finish preserves ${key}`).toBeCloseTo(beforeFinish[key], 1);
  }

  await page.locator("[data-continue]").click();
  const reviewPreview = page.locator('.concept-preview[data-layout="door-wall"]');
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Door Wall");
  await expect(page.locator('[data-summary-value="product"]')).toHaveText("Drawers + Shelves");
  await expect(reviewPreview).toHaveAttribute("data-preview-key", "bookcase:drawer-base-shelves:door-wall");
  const reviewImage = await expectIntegratedPreview(reviewPreview, asset);
  const reviewImageSource = await reviewImage.evaluate((image) => image.currentSrc);
  expect(reviewImageSource).toBe(afterFinish.currentSrc);
});

test("Drawers + Shelves keeps a truthful Clear Wall through review, navigation, reload, and resume", async ({ page }) => {
  const runtime = monitorRuntime(page);
  const presentation = resolvePreviewPresentation("bookcase", "drawer-base-shelves", "clear-wall");
  const conceptAsset = "assets/photos/configurator/room-layouts/room-clear-wall-v1.png";
  const previewKey = "bookcase:drawer-base-shelves:clear-wall";
  let selectedRoomAsset = null;
  const expectClearWallPreview = async () => {
    const preview = page.locator(
      '.concept-preview[data-category="bookcase"][data-style="drawer-base-shelves"][data-layout="clear-wall"]'
    );
    await expect(preview).toHaveAttribute("data-preview-key", previewKey);
    await expect(preview).toHaveAttribute("data-authored-layout", "clear-wall");
    await expect(preview).toHaveAttribute("data-layout-context-asset", /room-clear-wall-v1\.png$/);
    await expect(preview.locator('[data-layout-context="clear-wall"]')).toContainText("Clear Wall");
    expect(await preview.getAttribute("data-preview-asset")).not.toMatch(
      /(?:niche-layout|left-niche|right-niche|recess)/
    );
    await expectRoomPlusFurniturePreview(preview, presentation, selectedRoomAsset || conceptAsset);
    return preview;
  };
  const expectPersistedClearWall = async () => {
    await expect.poll(() => page.evaluate(() => {
      const rawDraft = localStorage.getItem("jqGuidedConfiguratorDraftV1");
      if (!rawDraft) return null;
      const draft = JSON.parse(rawDraft);
      return {
        layout: draft.layout,
        previewAsset: draft.previewAsset
      };
    })).toEqual({
      layout: "clear-wall",
      previewAsset: conceptAsset
    });
  };

  await page.setViewportSize({ width: 1024, height: 768 });
  await openFreshProject(page);
  await continueToLayouts(page, "Drawers + Shelves");
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();

  const measurementCard = page.locator(
    '.measurement-diagram-card[data-media-fit="cover"]'
  );
  const measurementRoom = page.locator(
    '.measurement-room[data-layout="clear-wall"][data-condition="clear-wall"]'
  );
  await expect(measurementCard).toHaveAttribute("data-media-aspect-ratio", "4 / 3");
  await expect(measurementRoom.locator("img.measurement-room-image")).toHaveCSS("object-fit", "cover");
  await expect(measurementRoom.locator("[data-dimension-drawing]")).toHaveAttribute(
    "preserveAspectRatio",
    "xMidYMid slice"
  );
  selectedRoomAsset = await measurementRoom.getAttribute("data-room-asset");
  expect(selectedRoomAsset).toBe(conceptAsset);
  await expect(page.locator(".selected-layout-chip")).toContainText("Clear Wall");
  await expectPersistedClearWall();

  await page.locator("[data-continue]").click();
  let preview = await expectClearWallPreview();
  await expectPersistedClearWall();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1.1");
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reset preview" })).toBeEnabled();
  await expectRoomPlusFurniturePreview(preview, presentation, conceptAsset);
  await page.getByRole("button", { name: "Reset preview" }).click();
  await expect(page.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1");
  await expectRoomPlusFurniturePreview(preview, presentation, conceptAsset);
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reset preview" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeEnabled();

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Clear Wall");
  await expect(page.locator('[data-summary-value="product"]')).toHaveText("Drawers + Shelves");
  await expectClearWallPreview();
  await expectPersistedClearWall();

  await page.locator('[data-step="4"]').click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await expectClearWallPreview();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expectClearWallPreview();

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await expectClearWallPreview();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expectClearWallPreview();

  await expect.poll(() => page.evaluate(() => {
    const rawDraft = localStorage.getItem("jqGuidedConfiguratorDraftV1");
    return rawDraft ? JSON.parse(rawDraft).currentStep : null;
  })).toBe(5);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expectClearWallPreview();
  await expectPersistedClearWall();

  await page.locator("[data-guided-save]").click();
  const saveDialog = page.locator("[data-save-dialog]");
  await saveDialog.getByLabel("Project name").fill("Clear Wall Regression");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await page.getByRole("button", { name: "My Projects", exact: true }).click();
  const projectsDialog = page.locator("[data-projects-dialog]");
  await projectsDialog.getByRole("button", { name: "Resume Clear Wall Regression" }).click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  preview = await expectClearWallPreview();
  await expect(preview).toHaveAttribute("data-authored-layout", "clear-wall");

  expect(runtime.filter((failure) => !failure.includes("net::ERR_ABORTED"))).toEqual([]);
});

test("Clear Wall bookcase installations stay on the rear wall plane and match approved visual snapshots", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1024, height: 768 });

  const expectTopologyScreenshot = async (preview, snapshotName) => {
    const scene = preview.locator("[data-concept-scene]");
    const controls = preview.locator(".preview-controls");
    const toast = page.locator("[data-guided-toast]");
    await controls.evaluate((element) => {
      element.style.visibility = "hidden";
    });
    await toast.evaluate((element) => {
      element.style.visibility = "hidden";
    });
    await expect(scene).toHaveScreenshot(snapshotName, {
      animations: "disabled",
      maxDiffPixelRatio: 0.001
    });
    await controls.evaluate((element) => {
      element.style.removeProperty("visibility");
    });
    await toast.evaluate((element) => {
      element.style.removeProperty("visibility");
    });
  };

  for (const product of [
    {
      label: "Full Open Shelving",
      styleId: "full-open-shelving",
      snapshotId: "full-open",
      furnitureAsset: "assets/photos/configurator/furniture/bookcase/full-open-shelving/clear-wall-furniture-v2.png",
      finishMaskAsset: "assets/photos/configurator/furniture/bookcase/full-open-shelving/clear-wall-finish-mask-v2.png",
      sourceAspectRatio: 885 / 648,
      alphaBounds: { left: 356, top: 108, right: 1181, bottom: 712, width: 825, height: 604 }
    },
    {
      label: "Drawers + Shelves",
      styleId: "drawer-base-shelves",
      snapshotId: "drawers",
      furnitureAsset: "assets/photos/configurator/furniture/bookcase/drawer-base-shelves/clear-wall-furniture-v2.png",
      finishMaskAsset: "assets/photos/configurator/furniture/bookcase/drawer-base-shelves/clear-wall-finish-mask-v2.png",
      sourceAspectRatio: 757 / 643,
      alphaBounds: { left: 412, top: 108, right: 1123, bottom: 712, width: 711, height: 604 }
    },
    {
      label: "Cabinets + Shelves",
      styleId: "cabinet-base-shelves",
      snapshotId: "cabinets",
      furnitureAsset: "assets/photos/configurator/furniture/bookcase/cabinet-base-shelves/clear-wall-furniture-v2.png",
      finishMaskAsset: "assets/photos/configurator/furniture/bookcase/cabinet-base-shelves/clear-wall-finish-mask-v2.png",
      sourceAspectRatio: 799 / 654,
      alphaBounds: { left: 399, top: 108, right: 1137, bottom: 712, width: 738, height: 604 }
    }
  ]) {
    await openFreshProject(page);
    await continueToLayouts(page, product.label);
    await chooseLayout(page, "Clear Wall");
    await page.locator("[data-continue]").click();

    const measurementRoom = page.locator('.measurement-room[data-layout="clear-wall"]');
    const selectedRoomAsset = await measurementRoom.getAttribute("data-room-asset");
    expect(selectedRoomAsset).toBe("assets/photos/configurator/room-layouts/room-clear-wall-v1.png");
    if (product.styleId === "full-open-shelving") {
      // The overlay contract is asserted structurally elsewhere. Hide it here so
      // platform-specific SVG text anti-aliasing cannot obscure a room-topology
      // regression in the painted photograph.
      const measurementOverlay = measurementRoom.locator("[data-dimension-overlay]");
      const toast = page.locator("[data-guided-toast]");
      await measurementOverlay.evaluate((element) => {
        element.style.visibility = "hidden";
      });
      await toast.evaluate((element) => {
        element.style.visibility = "hidden";
      });
      const measurementRoomPhoto = measurementRoom.locator(
        ":scope > picture.measurement-room-image"
      );
      await expect(measurementRoomPhoto).toHaveScreenshot(
        "clear-wall-full-open-step3-1024x768.png",
        { animations: "disabled", maxDiffPixelRatio: 0.001 }
      );
      await measurementOverlay.evaluate((element) => {
        element.style.removeProperty("visibility");
      });
      await toast.evaluate((element) => {
        element.style.removeProperty("visibility");
      });
    }

    await page.locator("[data-continue]").click();
    const presentation = resolvePreviewPresentation("bookcase", product.styleId, "clear-wall");
    expect(presentation.furnitureAsset).toBe(product.furnitureAsset);
    expect(presentation.finishMaskAsset).toBe(product.finishMaskAsset);
    const preview = page.locator(
      `.concept-preview[data-layout="clear-wall"][data-style="${product.styleId}"]`
    );
    const rendered = await expectRoomPlusFurniturePreview(
      preview,
      presentation,
      selectedRoomAsset
    );
    expect(rendered.media.alphaBounds).toEqual(product.alphaBounds);
    expect(
      rendered.media.alphaBounds.width / rendered.media.alphaBounds.height,
      "Clear Wall furniture keeps the approved source proportions"
    ).toBeCloseTo(product.sourceAspectRatio, 2);
    await expectTopologyScreenshot(
      preview,
      `clear-wall-${product.snapshotId}-step4-1024x768.png`
    );

    if (product.styleId === "full-open-shelving") {
      await page.locator("[data-continue]").click();
      const reviewPreview = page.locator(
        '.concept-preview[data-layout="clear-wall"][data-style="full-open-shelving"]'
      );
      await expectRoomPlusFurniturePreview(reviewPreview, presentation, selectedRoomAsset);
      await expectTopologyScreenshot(reviewPreview, "clear-wall-review-step5-1024x768.png");
    }
  }
});

test("Clear Wall room and concept media remain edge-filling at every acceptance viewport", async ({ page }) => {
  test.slow();
  const runtime = monitorRuntime(page);
  const presentation = resolvePreviewPresentation("bookcase", "drawer-base-shelves", "clear-wall");
  const conceptAsset = "assets/photos/configurator/room-layouts/room-clear-wall-v1.png";

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    const context = `${viewport.width}x${viewport.height}`;
    await page.setViewportSize(viewport);
    await openFreshProject(page);
    await continueToLayouts(page, "Drawers + Shelves");
    await chooseLayout(page, "Clear Wall");
    await page.locator("[data-continue]").click();

    const room = page.locator('.measurement-room[data-layout="clear-wall"]');
    await expect.poll(() => room.locator("img.measurement-room-image").evaluate((image) => (
      image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
    ))).toBe(true);
    const measurement = await room.evaluate((element) => {
      const tolerance = 1;
      const rect = element.getBoundingClientRect();
      const picture = element.querySelector(":scope > picture.measurement-room-image");
      const image = picture.querySelector(":scope > img.measurement-room-image");
      const overlay = element.querySelector(":scope > svg[data-dimension-overlay]");
      const pictureRect = picture.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      const sameRect = (candidate) => (
        Math.abs(candidate.left - rect.left) <= tolerance
        && Math.abs(candidate.top - rect.top) <= tolerance
        && Math.abs(candidate.right - rect.right) <= tolerance
        && Math.abs(candidate.bottom - rect.bottom) <= tolerance
      );
      const anchors = [...overlay.querySelectorAll("[data-dimension-line], [data-dimension-extension]")]
        .flatMap((line) => {
          const matrix = line.getScreenCTM();
          const point = (x, y) => {
            const sourcePoint = overlay.createSVGPoint();
            sourcePoint.x = x;
            sourcePoint.y = y;
            return sourcePoint.matrixTransform(matrix);
          };
          return [
            point(line.x1.baseVal.value, line.y1.baseVal.value),
            point(line.x2.baseVal.value, line.y2.baseVal.value)
          ];
        });
      return {
        objectFit: getComputedStyle(image).objectFit,
        preserveAspectRatio: overlay.getAttribute("preserveAspectRatio"),
        paintedWidth: image.naturalWidth * scale,
        paintedHeight: image.naturalHeight * scale,
        viewportWidth: rect.width,
        viewportHeight: rect.height,
        pictureFillsRoom: sameRect(pictureRect),
        imageBoxFillsRoom: sameRect(imageRect),
        overlayFillsRoom: sameRect(overlayRect),
        anchorsInsideRoom: anchors.every((point) => (
          point.x >= rect.left - tolerance
          && point.x <= rect.right + tolerance
          && point.y >= rect.top - tolerance
          && point.y <= rect.bottom + tolerance
        )),
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth
      };
    });
    expect(measurement.objectFit, `${context} room fit`).toBe("cover");
    expect(measurement.preserveAspectRatio, `${context} room SVG fit`).toBe("xMidYMid slice");
    expect(measurement.paintedWidth, `${context} painted room width`).toBeGreaterThanOrEqual(
      measurement.viewportWidth - 0.5
    );
    expect(measurement.paintedHeight, `${context} painted room height`).toBeGreaterThanOrEqual(
      measurement.viewportHeight - 0.5
    );
    expect(measurement.pictureFillsRoom, `${context} room picture box`).toBe(true);
    expect(measurement.imageBoxFillsRoom, `${context} room image box`).toBe(true);
    expect(measurement.overlayFillsRoom, `${context} room overlay box`).toBe(true);
    expect(measurement.anchorsInsideRoom, `${context} visible measurement anchors`).toBe(true);
    expect(measurement.horizontalOverflow, `${context} Room & Size overflow`).toBeLessThanOrEqual(1);

    await page.locator("[data-continue]").click();
    const preview = page.locator('.concept-preview[data-layout="clear-wall"]');
    await expectRoomPlusFurniturePreview(preview, presentation, conceptAsset);
    const customization = await preview.evaluate((element) => {
      const previewRect = element.getBoundingClientRect();
      const metaRect = element.querySelector(".concept-preview-meta").getBoundingClientRect();
      const sceneRect = element.querySelector("[data-concept-scene]").getBoundingClientRect();
      const zoomControlsRect = element.querySelector(".preview-controls").getBoundingClientRect();
      return {
        metaBeforeScene: metaRect.bottom <= sceneRect.top + 1,
        zoomControlsInside: (
          zoomControlsRect.left >= previewRect.left - 1
          && zoomControlsRect.right <= previewRect.right + 1
          && zoomControlsRect.top >= previewRect.top - 1
          && zoomControlsRect.bottom <= previewRect.bottom + 1
        ),
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth
      };
    });
    expect(customization.metaBeforeScene, `${context} metadata stays above the photograph`).toBe(true);
    expect(customization.zoomControlsInside, `${context} zoom controls stay inside the preview`).toBe(true);
    expect(customization.horizontalOverflow, `${context} Customization overflow`).toBeLessThanOrEqual(1);
  }

  expect(runtime.filter((failure) => !failure.includes("net::ERR_ABORTED"))).toEqual([]);
});

test("Right Niche shows only room perimeter dimensions and one integrated preview", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Right Niche");
  await page.locator("[data-continue]").click();

  const diagram = page.locator(".measurement-diagram-card");
  const room = diagram.locator(".measurement-room");
  const guideLabels = diagram.locator(".measurement-annotation-label");
  await expect(room.locator(":scope > .dimension-overlay")).toBeVisible();
  await expect(guideLabels.locator(".measurement-annotation-code")).toHaveCount(0);
  await expect(guideLabels.locator(".measurement-annotation-name")).toHaveText([
    "Wall width",
    "Ceiling height"
  ]);
  await expect(diagram.locator("[data-dimension-value]")).toHaveText([
    "120 in",
    "96 in"
  ]);
  await expect(diagram.locator("[data-dimension-span]")).toHaveCount(2);
  await expect(diagram.locator("[data-dimension-line]")).toHaveCount(2);
  await expect(diagram.locator("[data-dimension-extension]")).toHaveCount(4);
  await expect(diagram.locator("[data-dimension-end]")).toHaveCount(4);
  await expect(diagram.locator('[data-dimension-span="desiredDepth"]')).toHaveCount(0);
  await expect(diagram.locator('[data-dimension-span="nicheWidth"]')).toHaveCount(0);
  await expect(diagram.locator('[data-dimension-span="nicheHeight"]')).toHaveCount(0);
  await expect(diagram.locator('[data-dimension-span="nicheDepth"]')).toHaveCount(0);
  await expect(page.locator('[data-measurement-row="wallWidth"] .measurement-code')).toHaveText("A");
  await expect(page.locator('[data-measurement-row="ceilingHeight"] .measurement-code')).toHaveText("B");
  await expect(page.locator('[data-measurement-row="desiredDepth"] .measurement-code')).toHaveText("C");

  const guideGeometry = await room.evaluate((element) => {
    const roomRect = element.getBoundingClientRect();
    const callouts = [...element.querySelectorAll(".measurement-annotation-copy")].map((callout) => {
      const rect = callout.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    const overlaps = (first, second) => (
      first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      allInsideRoom: callouts.every((rect) => (
        rect.left >= roomRect.left - 1
        && rect.right <= roomRect.right + 1
        && rect.top >= roomRect.top - 1
        && rect.bottom <= roomRect.bottom + 1
      )),
      overlappingPairs: callouts.flatMap((first, index) => (
        callouts.slice(index + 1).filter((second) => overlaps(first, second))
      )).length
    };
  });
  expect(guideGeometry.allInsideRoom).toBe(true);
  expect(guideGeometry.overlappingPairs).toBe(0);

  await page.locator('[data-measurement="wallWidth"]').fill("132");
  await expect(diagram.locator('[data-dimension-chip="wallWidth"] [data-dimension-value]')).toHaveText("132 in");
  await page.locator("[data-continue]").click();

  const preview = page.locator('.concept-preview[data-layout="right-niche"]');
  const metadata = preview.locator(".concept-preview-meta");
  const context = preview.locator('[data-layout-context="right-niche"]');
  await expect(preview).toHaveAttribute(
    "data-preview-asset",
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-v1.png"
  );
  await expectIntegratedPreview(
    preview,
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-v1.png"
  );
  await expect(context).toContainText("Right Niche");
  const previewGeometry = await preview.evaluate((element) => {
    const meta = element.querySelector(".concept-preview-meta").getBoundingClientRect();
    const scene = element.querySelector(".concept-scene").getBoundingClientRect();
    const finish = element.querySelector(".concept-finish-caption").getBoundingClientRect();
    const contextRect = element.querySelector("[data-layout-context]").getBoundingClientRect();
    const overlaps = (first, second) => (
      first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      metadataBeforeScene: meta.bottom <= scene.top + 1,
      contextBeforeScene: contextRect.bottom <= scene.top + 1,
      labelsOverlap: overlaps(finish, contextRect)
    };
  });
  expect(previewGeometry.metadataBeforeScene).toBe(true);
  expect(previewGeometry.contextBeforeScene).toBe(true);
  expect(previewGeometry.labelsOverlap).toBe(false);
  await expect(metadata).toBeVisible();
});

test("Drawers + Shelves Right Niche stays one-screen and completely framed through every preview state", async ({ page }) => {
  test.slow();
  const runtime = monitorRuntime(page);
  const expectedFields = [
    "wallWidth",
    "ceilingHeight",
    "desiredDepth",
    "nicheWidth",
    "nicheHeight",
    "nicheDepth",
    "leftReturn",
    "rightReturn"
  ];

  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 }
  ]) {
    const viewportContext = `${viewport.width}x${viewport.height} Drawers + Shelves / Right Niche`;
    await test.step(viewportContext, async () => {
      await page.setViewportSize(viewport);
      await openFreshProject(page);
      await continueToLayouts(page, "Drawers + Shelves");
      await chooseLayout(page, "Right Niche");
      await page.locator("[data-continue]").click();

      await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
      await expect(page.locator(".selected-layout-chip")).toContainText("Right Niche");
      expect(
        await page.locator("[data-measurement-row]").evaluateAll((rows) => (
          rows.map((row) => row.dataset.measurementRow)
        )),
        `${viewportContext} exact measurement fields`
      ).toEqual(expectedFields);
      for (const fieldId of expectedFields) {
        await expect(
          page.locator(`[data-measurement-row="${fieldId}"]`),
          `${viewportContext} ${fieldId} row`
        ).toBeVisible();
        await expect(
          page.locator(`[data-measurement="${fieldId}"]`),
          `${viewportContext} ${fieldId} control`
        ).toBeVisible();
      }
      await expect(page.locator(".guided-info")).toContainText(
        "Don’t worry if your measurements are approximate"
      );
      await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
      await expectMeasurementWorkspaceInOneScreen(page, `${viewportContext} Room & Size`);

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
      await expectCustomizationWorkspaceInOneScreen(page, `${viewportContext} Customization`);

      let preview = page.locator(
        '.concept-preview[data-category="bookcase"][data-style="drawer-base-shelves"][data-layout="right-niche"]'
      );
      await expectDrawersRightNicheComposition(preview, `${viewportContext} initial`);

      await page.getByRole("button", { name: "Charcoal", exact: true }).click();
      preview = page.locator(
        '.concept-preview[data-category="bookcase"][data-style="drawer-base-shelves"][data-layout="right-niche"]'
      );
      await expect(preview).toHaveAttribute("data-finish", "charcoal");
      await expectDrawersRightNicheComposition(preview, `${viewportContext} Charcoal`);

      await page.getByRole("tab", { name: "Details" }).click();
      preview = page.locator(
        '.concept-preview[data-category="bookcase"][data-style="drawer-base-shelves"][data-layout="right-niche"]'
      );
      await expectDrawersRightNicheComposition(preview, `${viewportContext} Details tab`);
      await page.getByRole("tab", { name: "Finish" }).click();
      preview = page.locator(
        '.concept-preview[data-category="bookcase"][data-style="drawer-base-shelves"][data-layout="right-niche"]'
      );
      await expectDrawersRightNicheComposition(preview, `${viewportContext} Finish tab`);
      await expectCustomizationWorkspaceInOneScreen(page, `${viewportContext} Finish tab`);

      await page.getByRole("button", { name: "Zoom in" }).click();
      await expect(preview.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1.1");
      await expect(preview).toHaveAttribute(
        "data-preview-asset",
        "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/right-niche-v2.png"
      );
      await expect(preview.locator("svg.concept-finish-overlay mask image")).toHaveAttribute(
        "href",
        "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/right-niche-finish-mask-v2.png"
      );
      await page.getByRole("button", { name: "Reset preview" }).click();
      await expect(preview.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1");
      await expectDrawersRightNicheComposition(preview, `${viewportContext} zoom reset`);

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
      await expect(page.locator('[data-summary-value="product"]')).toHaveText("Drawers + Shelves");
      await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Right Niche");
      preview = page.locator(
        '.concept-preview[data-category="bookcase"][data-style="drawer-base-shelves"][data-layout="right-niche"]'
      );
      await expectDrawersRightNicheComposition(preview, `${viewportContext} Review`);

      await page.locator('[data-step="4"]').click();
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
      preview = page.locator(
        '.concept-preview[data-category="bookcase"][data-style="drawer-base-shelves"][data-layout="right-niche"]'
      );
      await expectDrawersRightNicheComposition(preview, `${viewportContext} Review back to Customization`);
      await expectCustomizationWorkspaceInOneScreen(
        page,
        `${viewportContext} Review back to Customization`
      );

      await expect.poll(() => page.evaluate(() => {
        const rawDraft = localStorage.getItem("jqGuidedConfiguratorDraftV1");
        if (!rawDraft) return null;
        const draft = JSON.parse(rawDraft);
        return {
          currentStep: draft.currentStep,
          finish: draft.finish,
          layout: draft.layout
        };
      })).toEqual({
        currentStep: 4,
        finish: "charcoal",
        layout: "right-niche"
      });
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
      preview = page.locator(
        '.concept-preview[data-category="bookcase"][data-style="drawer-base-shelves"][data-layout="right-niche"]'
      );
      await expect(preview).toHaveAttribute("data-finish", "charcoal");
      await expectDrawersRightNicheComposition(preview, `${viewportContext} reload`);
      await expectCustomizationWorkspaceInOneScreen(page, `${viewportContext} reload`);
    });
  }

  expect(runtime.filter((failure) => !failure.includes("net::ERR_ABORTED"))).toEqual([]);
});

test("TV Unit keeps the selected Clear Wall photo free of synthetic room features", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();

  const diagram = page.locator(".measurement-diagram-card");
  const room = diagram.locator(".measurement-room");
  const tv = room.locator(".measurement-feature");

  await expect(room).toHaveAttribute("data-feature", "none");
  await expect(tv).toHaveCount(0);
  await expect(diagram.locator(".measurement-annotation-code")).toHaveCount(0);
  await expect(diagram.locator(".measurement-annotation-name")).toHaveText([
    "Wall width",
    "Ceiling height"
  ]);
  await expect(diagram.locator("[data-dimension-span]")).toHaveCount(2);
  await expect(diagram.locator('[data-dimension-span="tvScreenSize"]')).toHaveCount(0);
  await expect(diagram.locator('[data-dimension-span="tvHeight"]')).toHaveCount(0);
  await expect(page.locator('[data-measurement-row="tvScreenSize"] .measurement-code')).toHaveText("D");
  await expect(page.locator('[data-measurement-row="tvHeight"] .measurement-code')).toHaveText("E");

  const geometry = await diagram.evaluate((element) => {
    const bounds = (selector) => {
      const rect = element.querySelector(selector).getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      };
    };
    const diagramRect = element.getBoundingClientRect();
    const labels = [...element.querySelectorAll("[data-dimension-label]")].map((label) => (
      bounds(`[data-dimension-label="${CSS.escape(label.dataset.dimensionLabel)}"]`)
    ));
    const lineLength = (fieldId) => {
      const line = element.querySelector(`[data-dimension-line="${fieldId}"]`);
      const matrix = line.getScreenCTM();
      const point = (x, y) => {
        const svgPoint = line.ownerSVGElement.createSVGPoint();
        svgPoint.x = x;
        svgPoint.y = y;
        return svgPoint.matrixTransform(matrix);
      };
      const start = point(line.x1.baseVal.value, line.y1.baseVal.value);
      const end = point(line.x2.baseVal.value, line.y2.baseVal.value);
      return Math.hypot(end.x - start.x, end.y - start.y);
    };
    const overlaps = (first, second) => (
      first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      calloutsOverlap: overlaps(labels[0], labels[1]),
      widthLineLength: lineLength("wallWidth"),
      heightLineLength: lineLength("ceilingHeight"),
      allInsideDiagram: labels.every((rect) => (
        rect.left >= diagramRect.left
        && rect.right <= diagramRect.right
        && rect.top >= diagramRect.top
        && rect.bottom <= diagramRect.bottom
      ))
    };
  });

  expect(geometry.calloutsOverlap).toBe(false);
  expect(geometry.widthLineLength).toBeGreaterThan(20);
  expect(geometry.heightLineLength).toBeGreaterThan(20);
  expect(geometry.allInsideDiagram).toBe(true);
});

test("all ten bookcase layouts render one responsive two-dimension perimeter overlay", async ({ page }) => {
  test.slow();

  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 }
  ]) {
    await page.setViewportSize(viewport);
    await openFreshProject(page);
    await continueToLayouts(page, "Drawers + Shelves");

    for (const roomLayout of sharedLayouts) {
      await chooseLayout(page, roomLayout.label);
      await page.locator("[data-continue]").click();

      const room = page.locator(`.measurement-room[data-layout="${roomLayout.id}"]`);
      const drawing = room.locator("[data-dimension-drawing]");
      const spans = drawing.locator("[data-dimension-span]");
      const labels = room.locator("[data-dimension-label]");
      const context = `${viewport.width}x${viewport.height} ${roomLayout.label}`;

      await expect(room, `${context} room`).toBeVisible();
      await expect(drawing, `${context} drawing`).toBeVisible();
      await expect(drawing, `${context} count metadata`).toHaveAttribute("data-dimension-count", "2");
      await expect(spans, `${context} spans`).toHaveCount(2);
      await expect(labels, `${context} labels`).toHaveCount(2);
      expect(
        await spans.evaluateAll((elements) => elements.map((element) => element.dataset.dimensionSpan)),
        `${context} ordered perimeter fields`
      ).toEqual(visibleMeasurementDimensions);
      expect(
        await labels.evaluateAll((elements) => elements.map((element) => element.dataset.dimensionLabel)),
        `${context} ordered perimeter labels`
      ).toEqual(visibleMeasurementDimensions);
      await expect(drawing.locator(".measurement-annotation-code"), `${context} image codes`).toHaveCount(0);
      await expect(drawing.locator("[data-dimension-line]"), `${context} main lines`).toHaveCount(2);
      await expect(drawing.locator("[data-dimension-extension]"), `${context} endpoint extensions`).toHaveCount(4);
      await expect(drawing.locator("[data-dimension-end]"), `${context} arrowheads`).toHaveCount(4);
      await expect(drawing.locator('[data-dimension-span="desiredDepth"]'), `${context} no depth`).toHaveCount(0);

      await expect.poll(
        () => room.locator("img.measurement-room-image").evaluate((image) => (
          image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
        )),
        { message: `${context} room image loaded` }
      ).toBe(true);

      const geometry = await room.evaluate((element) => {
        const tolerance = 1;
        const roomRect = element.getBoundingClientRect();
        const drawingElement = element.querySelector("[data-dimension-drawing]");
        const imageElement = element.querySelector("img.measurement-room-image");
        const imageStyle = getComputedStyle(imageElement);
        const roomStyle = getComputedStyle(element);
        const diagram = element.closest(".measurement-diagram-card");
        const spanElements = [...element.querySelectorAll("[data-dimension-span]")];
        const visibleLabels = [...element.querySelectorAll("[data-dimension-label] .measurement-annotation-copy")]
          .filter((label) => {
            const style = getComputedStyle(label);
            const rect = label.getBoundingClientRect();
            return (
              style.display !== "none"
              && style.visibility !== "hidden"
              && Number(style.opacity) > 0
              && rect.width > 0
              && rect.height > 0
            );
          })
          .map((label) => {
            const rect = label.getBoundingClientRect();
            return {
              fieldId: label.closest("[data-dimension-label]").dataset.dimensionLabel,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom
            };
          });
        const overlaps = (first, second) => (
          first.left < second.right - tolerance
          && first.right > second.left + tolerance
          && first.top < second.bottom - tolerance
          && first.bottom > second.top + tolerance
        );
        const lineLength = (line) => {
          const matrix = line.getScreenCTM();
          const point = (x, y) => {
            const svgPoint = line.ownerSVGElement.createSVGPoint();
            svgPoint.x = x;
            svgPoint.y = y;
            return svgPoint.matrixTransform(matrix);
          };
          const start = point(line.x1.baseVal.value, line.y1.baseVal.value);
          const end = point(line.x2.baseVal.value, line.y2.baseVal.value);
          return Math.hypot(end.x - start.x, end.y - start.y);
        };
        const spanReports = spanElements.map((span) => {
          const fieldId = span.dataset.dimensionSpan;
          const line = span.querySelector(`[data-dimension-line="${CSS.escape(fieldId)}"]`);
          const extensions = [...span.querySelectorAll(`[data-dimension-extension="${CSS.escape(fieldId)}"]`)];
          const lineStyle = getComputedStyle(line);
          return {
            fieldId,
            endStyle: span.dataset.dimensionEndStyle,
            lineCount: span.querySelectorAll(`[data-dimension-line="${CSS.escape(fieldId)}"]`).length,
            extensionCount: extensions.length,
            ticks: extensions.map((extension) => extension.dataset.dimensionTick),
            endTickCount: extensions.filter((extension) => extension.classList.contains("is-end-tick")).length,
            arrowCount: span.querySelectorAll("[data-dimension-end]").length,
            nestedLabelCount: span.querySelectorAll(":scope [data-dimension-label]").length,
            visibleStroke: lineStyle.stroke !== "none" && Number(lineStyle.opacity) > 0,
            lineLength: lineLength(line)
          };
        });
        const overlappingPairs = visibleLabels.flatMap((first, index) => (
          visibleLabels.slice(index + 1)
            .filter((second) => overlaps(first, second))
            .map((second) => `${first.fieldId}/${second.fieldId}`)
        ));
        const objectPosition = imageStyle.objectPosition
          .split(" ")
          .map((value) => Number.parseFloat(value) / 100);
        const coverScale = Math.max(
          roomRect.width / imageElement.naturalWidth,
          roomRect.height / imageElement.naturalHeight
        );
        const paintedWidth = imageElement.naturalWidth * coverScale;
        const paintedHeight = imageElement.naturalHeight * coverScale;
        const paintedLeft = roomRect.left - (paintedWidth - roomRect.width) * objectPosition[0];
        const paintedTop = roomRect.top - (paintedHeight - roomRect.height) * objectPosition[1];
        const visibleSource = {
          left: (roomRect.left - paintedLeft) / coverScale,
          right: (roomRect.right - paintedLeft) / coverScale,
          top: (roomRect.top - paintedTop) / coverScale,
          bottom: (roomRect.bottom - paintedTop) / coverScale
        };
        const sourcePoint = (svg, x, y) => {
          const point = svg.createSVGPoint();
          point.x = x;
          point.y = y;
          const screenPoint = point.matrixTransform(svg.getScreenCTM());
          return { x: screenPoint.x, y: screenPoint.y };
        };
        const expectedScreenPoint = (x, y) => ({
          x: paintedLeft + x * coverScale,
          y: paintedTop + y * coverScale
        });
        const sourcePairs = spanElements.flatMap((span) => {
          const fieldId = span.dataset.dimensionSpan;
          const line = span.querySelector(`[data-dimension-line="${CSS.escape(fieldId)}"]`);
          const extensions = [...span.querySelectorAll(`[data-dimension-extension="${CSS.escape(fieldId)}"]`)];
          return [
            { fieldId, kind: "line-start", x: line.x1.baseVal.value, y: line.y1.baseVal.value },
            { fieldId, kind: "line-end", x: line.x2.baseVal.value, y: line.y2.baseVal.value },
            ...extensions.flatMap((extension, extensionIndex) => [
              {
                fieldId,
                kind: `extension-${extensionIndex}-start`,
                x: extension.x1.baseVal.value,
                y: extension.y1.baseVal.value
              },
              {
                fieldId,
                kind: `extension-${extensionIndex}-end`,
                x: extension.x2.baseVal.value,
                y: extension.y2.baseVal.value
              }
            ])
          ];
        });
        const anchorReports = sourcePairs.map((anchor) => {
          const rendered = sourcePoint(drawingElement, anchor.x, anchor.y);
          const expected = expectedScreenPoint(anchor.x, anchor.y);
          return {
            ...anchor,
            insideVisibleCrop: (
              anchor.x >= visibleSource.left - tolerance / coverScale
              && anchor.x <= visibleSource.right + tolerance / coverScale
              && anchor.y >= visibleSource.top - tolerance / coverScale
              && anchor.y <= visibleSource.bottom + tolerance / coverScale
            ),
            transformDelta: Math.hypot(rendered.x - expected.x, rendered.y - expected.y)
          };
        });
        const expectedAlignment = `${objectPosition[0] === 0 ? "xMin" : objectPosition[0] === 1 ? "xMax" : "xMid"}${objectPosition[1] === 0 ? "YMin" : objectPosition[1] === 1 ? "YMax" : "YMid"} slice`;

        return {
          drawingInsideRoom: (() => {
            const rect = drawingElement.getBoundingClientRect();
            return (
              rect.left >= roomRect.left - tolerance
              && rect.right <= roomRect.right + tolerance
              && rect.top >= roomRect.top - tolerance
              && rect.bottom <= roomRect.bottom + tolerance
            );
          })(),
          oneResponsiveOverlay: element.querySelectorAll(":scope > svg[data-dimension-overlay]").length === 1,
          viewBoxMatchesImage: (() => {
            const viewBox = drawingElement.viewBox.baseVal;
            return Math.abs(
              (viewBox.width / viewBox.height)
              - (imageElement.naturalWidth / imageElement.naturalHeight)
            ) < 0.000001;
          })(),
          coverTransformsMatch: (
            drawingElement.getAttribute("preserveAspectRatio") === expectedAlignment
            && imageStyle.objectFit === "cover"
            && imageStyle.objectPosition === diagram.dataset.mediaPosition
          ),
          paintedImageCoversViewport: (
            paintedWidth >= roomRect.width - tolerance
            && paintedHeight >= roomRect.height - tolerance
          ),
          noMediaInset: (
            Number.parseFloat(roomStyle.paddingLeft) === 0
            && Number.parseFloat(roomStyle.paddingRight) === 0
            && Number.parseFloat(roomStyle.paddingTop) === 0
            && Number.parseFloat(roomStyle.paddingBottom) === 0
          ),
          croppedAnchors: anchorReports
            .filter((anchor) => !anchor.insideVisibleCrop)
            .map((anchor) => `${anchor.fieldId}/${anchor.kind}`),
          maximumTransformDelta: Math.max(...anchorReports.map((anchor) => anchor.transformDelta)),
          pointerEventsDisabled: (
            getComputedStyle(drawingElement).pointerEvents === "none"
            && spanElements.every((span) => getComputedStyle(span).pointerEvents === "none")
          ),
          visibleLabelCount: visibleLabels.length,
          labelsInsideRoom: visibleLabels.every((rect) => (
            rect.left >= roomRect.left - tolerance
            && rect.right <= roomRect.right + tolerance
            && rect.top >= roomRect.top - tolerance
            && rect.bottom <= roomRect.bottom + tolerance
          )),
          overlappingPairs,
          spanReports,
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
          verticalOverflow: document.documentElement.scrollHeight - window.innerHeight
        };
      });

      expect(geometry.drawingInsideRoom, `${context} drawing stays inside room`).toBe(true);
      expect(geometry.oneResponsiveOverlay, `${context} uses one SVG overlay`).toBe(true);
      expect(geometry.viewBoxMatchesImage, `${context} SVG ratio matches the room image`).toBe(true);
      expect(geometry.coverTransformsMatch, `${context} image and SVG share one cover transform`).toBe(true);
      expect(geometry.paintedImageCoversViewport, `${context} painted photograph covers the media viewport`).toBe(true);
      expect(geometry.noMediaInset, `${context} media viewport has no padding`).toBe(true);
      expect(geometry.croppedAnchors, `${context} measurement anchors survive the cover crop`).toEqual([]);
      expect(geometry.maximumTransformDelta, `${context} overlay stays registered to the photograph`).toBeLessThanOrEqual(1);
      expect(geometry.pointerEventsDisabled, `${context} overlay ignores pointer events`).toBe(true);
      expect(geometry.visibleLabelCount, `${context} visible label count`).toBe(2);
      expect(geometry.labelsInsideRoom, `${context} labels stay inside room`).toBe(true);
      expect(geometry.overlappingPairs, `${context} labels do not overlap`).toEqual([]);
      expect(geometry.horizontalOverflow, `${context} horizontal overflow`).toBeLessThanOrEqual(1);
      expect(geometry.verticalOverflow, `${context} vertical overflow`).toBeLessThanOrEqual(1);
      await expectMeasurementWorkspaceInOneScreen(page, context);
      for (const span of geometry.spanReports) {
        expect(span.lineCount, `${context} ${span.fieldId} main line`).toBe(1);
        expect(span.extensionCount, `${context} ${span.fieldId} witness lines`).toBe(2);
        expect(span.ticks, `${context} ${span.fieldId} witness endpoints`).toEqual(["start", "end"]);
        expect(span.nestedLabelCount, `${context} ${span.fieldId} nested label`).toBe(1);
        expect(span.endStyle, `${context} ${span.fieldId} arrow end style`).toBe("arrow");
        expect(span.endTickCount, `${context} ${span.fieldId} short endpoint extensions`).toBe(2);
        expect(span.arrowCount, `${context} ${span.fieldId} arrowheads`).toBe(2);
        expect(span.visibleStroke, `${context} ${span.fieldId} stroke`).toBe(true);
        expect(span.lineLength, `${context} ${span.fieldId} rendered line length`).toBeGreaterThan(10);
      }

      await page.locator("[data-back]").click();
      await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
    }
  }
});

test("dense iPad Room & Size keeps both Between Openings perimeter cards readable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Between Openings");
  await page.locator("[data-continue]").click();

  const layout = page.locator(".measurement-layout--dense");
  const room = page.locator('.measurement-room[data-layout="double-opening"]');
  const drawing = room.locator("svg[data-dimension-overlay]");
  await expect(layout).toBeVisible();
  await expect(drawing).toHaveAttribute("viewBox", "0 0 1536 1024");
  await expect(drawing).toHaveAttribute("preserveAspectRatio", "xMidYMid slice");
  await expect(drawing.locator("[data-dimension-span]")).toHaveCount(2);

  const geometry = await page.evaluate(() => {
    const layoutElement = document.querySelector(".measurement-layout--dense");
    const panel = layoutElement.querySelector(".measurement-panel");
    const diagram = layoutElement.querySelector(".measurement-diagram-card");
    const roomElement = diagram.querySelector('.measurement-room[data-layout="double-opening"]');
    const drawingElement = roomElement.querySelector("svg[data-dimension-overlay]");
    const roomRect = roomElement.getBoundingClientRect();
    const lineSource = (fieldId) => {
      const line = drawingElement.querySelector(`[data-dimension-line="${CSS.escape(fieldId)}"]`);
      return [
        line.x1.baseVal.value,
        line.y1.baseVal.value,
        line.x2.baseVal.value,
        line.y2.baseVal.value
      ];
    };
    const labels = [...roomElement.querySelectorAll("[data-dimension-label]")].map((label) => {
      const rect = label.querySelector(".measurement-annotation-card").getBoundingClientRect();
      return {
        fieldId: label.dataset.dimensionLabel,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      };
    });
    const overlaps = (first, second) => (
      first.left < second.right - 1
      && first.right > second.left + 1
      && first.top < second.bottom - 1
      && first.bottom > second.top + 1
    );
    return {
      panelWidth: panel.getBoundingClientRect().width,
      diagramWidth: diagram.getBoundingClientRect().width,
      lineSources: {
        wallWidth: lineSource("wallWidth"),
        ceilingHeight: lineSource("ceilingHeight")
      },
      clippedLabels: labels
        .filter((label) => (
          label.left < roomRect.left - 1
          || label.right > roomRect.right + 1
          || label.top < roomRect.top - 1
          || label.bottom > roomRect.bottom + 1
        ))
        .map((label) => label.fieldId),
      labelOverlaps: labels.flatMap((first, index) => (
        labels.slice(index + 1)
          .filter((second) => overlaps(first, second))
          .map((second) => `${first.fieldId}/${second.fieldId}`)
      ))
    };
  });

  expect(geometry.panelWidth).toBeGreaterThanOrEqual(450);
  expect(geometry.panelWidth).toBeLessThanOrEqual(475);
  expect(geometry.diagramWidth).toBeGreaterThanOrEqual(700);
  expect(Math.abs(geometry.lineSources.wallWidth[0] - 304), "left wall boundary").toBeLessThan(1);
  expect(Math.abs(geometry.lineSources.wallWidth[2] - 1230), "right wall boundary").toBeLessThan(1);
  expect(geometry.lineSources.wallWidth[1]).toBe(geometry.lineSources.wallWidth[3]);
  expect(Math.abs(geometry.lineSources.ceilingHeight[1] - 150), "ceiling boundary").toBeLessThan(1);
  expect(Math.abs(geometry.lineSources.ceilingHeight[3] - 785), "finished floor boundary").toBeLessThan(1);
  expect(geometry.lineSources.ceilingHeight[0]).toBe(geometry.lineSources.ceilingHeight[2]);
  expect(geometry.clippedLabels).toEqual([]);
  expect(geometry.labelOverlaps).toEqual([]);
});

test("Door Wall dimension overlay stays on the measured architecture at desktop and iPad landscape sizes", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1180, height: 820 }
  ]) {
    await page.setViewportSize(viewport);
    await openFreshProject(page);
    await continueToLayouts(page);
    await chooseLayout(page, "Door Wall");
    await page.locator("[data-continue]").click();

    const room = page.locator('.measurement-room[data-layout="door-wall"]');
    const drawing = room.locator("svg[data-dimension-overlay]");
    const context = `${viewport.width}x${viewport.height} Door Wall`;
    await expect(drawing, `${context} overlay`).toHaveCount(1);
    await expect(drawing).toHaveAttribute("viewBox", "0 0 1536 1024");
    await expect(drawing).toHaveAttribute("preserveAspectRatio", "xMidYMid slice");
    await expect(drawing.locator("[data-dimension-span]")).toHaveCount(2);
    await expect(drawing.locator("[data-dimension-extension]")).toHaveCount(4);
    await expect(drawing.locator("[data-dimension-end]")).toHaveCount(4);
    await expect(room.locator(":scope > [data-dimension-label]")).toHaveCount(0);

    const geometry = await room.evaluate((element) => {
      const svg = element.querySelector("svg[data-dimension-overlay]");
      const roomRect = element.getBoundingClientRect();
      const sourcePoint = (x, y) => {
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        const screenPoint = point.matrixTransform(svg.getScreenCTM());
        return { x: screenPoint.x, y: screenPoint.y };
      };
      const lineReport = (fieldId) => {
        const line = svg.querySelector(`[data-dimension-line="${CSS.escape(fieldId)}"]`);
        const start = sourcePoint(line.x1.baseVal.value, line.y1.baseVal.value);
        const end = sourcePoint(line.x2.baseVal.value, line.y2.baseVal.value);
        return {
          source: [
            line.x1.baseVal.value,
            line.y1.baseVal.value,
            line.x2.baseVal.value,
            line.y2.baseVal.value
          ],
          start,
          end,
          dx: end.x - start.x,
          dy: end.y - start.y
        };
      };
      const labels = [...svg.querySelectorAll("[data-dimension-label]")].map((label) => {
        const rect = label.querySelector(".measurement-annotation-card").getBoundingClientRect();
        return {
          fieldId: label.dataset.dimensionLabel,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        };
      });
      const overlaps = (first, second) => (
        first.left < second.right - 1
        && first.right > second.left + 1
        && first.top < second.bottom - 1
        && first.bottom > second.top + 1
      );
      const openingTopLeft = sourcePoint(659, 279);
      const openingBottomRight = sourcePoint(880, 758);
      const doorOpening = {
        left: openingTopLeft.x,
        right: openingBottomRight.x,
        top: openingTopLeft.y,
        bottom: openingBottomRight.y
      };
      return {
        lines: {
          wallWidth: lineReport("wallWidth"),
          ceilingHeight: lineReport("ceilingHeight")
        },
        labelsInsideRoom: labels.every((label) => (
          label.left >= roomRect.left - 1
          && label.right <= roomRect.right + 1
          && label.top >= roomRect.top - 1
          && label.bottom <= roomRect.bottom + 1
        )),
        labelOverlaps: labels.flatMap((first, index) => (
          labels.slice(index + 1)
            .filter((second) => overlaps(first, second))
            .map((second) => `${first.fieldId}/${second.fieldId}`)
        )),
        labelsOverDoor: labels
          .filter((label) => overlaps(label, doorOpening))
          .map((label) => label.fieldId),
        renderedFields: [...svg.querySelectorAll("[data-dimension-span]")]
          .map((span) => span.dataset.dimensionSpan),
        depthDimensionCount: svg.querySelectorAll('[data-dimension-span="desiredDepth"]').length,
        doorDimensionCount: svg.querySelectorAll(
          '[data-dimension-span="doorWidth"], [data-dimension-span="doorHeight"], [data-dimension-span="doorLeftDistance"]'
        ).length,
        trimDimensionCount: svg.querySelectorAll('[data-dimension-span="doorTrimWidth"]').length,
        swingDimensionCount: svg.querySelectorAll('[data-dimension-span="doorSwing"]').length
      };
    });

    expect(Math.abs(geometry.lines.wallWidth.source[0] - 240), `${context} left wall anchor`).toBeLessThan(1);
    expect(Math.abs(geometry.lines.wallWidth.source[2] - 1295), `${context} right wall anchor`).toBeLessThan(1);
    expect(Math.abs(geometry.lines.ceilingHeight.source[1] - 157), `${context} ceiling anchor`).toBeLessThan(1);
    expect(Math.abs(geometry.lines.ceilingHeight.source[3] - 758), `${context} floor anchor`).toBeLessThan(1);
    expect(Math.abs(geometry.lines.wallWidth.dy), `${context} wall width is horizontal`).toBeLessThan(0.01);
    expect(Math.abs(geometry.lines.ceilingHeight.dx), `${context} ceiling height is vertical`).toBeLessThan(0.01);
    expect(geometry.labelsInsideRoom, `${context} cards remain inside the room`).toBe(true);
    expect(geometry.labelOverlaps, `${context} cards do not overlap`).toEqual([]);
    expect(geometry.labelsOverDoor, `${context} cards do not cover the door opening`).toEqual([]);
    expect(geometry.renderedFields, `${context} visible dimensions`).toEqual(visibleMeasurementDimensions);
    expect(geometry.depthDimensionCount, `${context} omits depth`).toBe(0);
    expect(geometry.doorDimensionCount, `${context} omits door feature dimensions`).toBe(0);
    expect(geometry.trimDimensionCount, `${context} trim is not a long wall dimension`).toBe(0);
    expect(geometry.swingDimensionCount, `${context} swing is not a linear dimension`).toBe(0);

    const updates = new Map([
      ["wallWidth", ["132", "132 in"]],
      ["ceilingHeight", ["101", "101 in"]]
    ]);
    for (const [fieldId, [inputValue, expectedValue]] of updates) {
      await page.locator(`[data-measurement="${fieldId}"]`).fill(inputValue);
      await expect(
        drawing.locator(`[data-dimension-label="${fieldId}"] [data-dimension-value]`),
        `${context} ${fieldId} value`
      ).toHaveText(expectedValue);
    }
  }
});

test("landscape tablet lets selection steps scroll while Room & Size and Customization fit one screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openFreshProject(page);
  await chooseProduct(page);
  const stepOneOverflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    vertical: document.documentElement.scrollHeight - window.innerHeight
  }));
  expect(stepOneOverflow.horizontal).toBeLessThanOrEqual(1);
  expect(stepOneOverflow.vertical).toBeGreaterThan(0);

  await page.locator("[data-continue]").click();
  const stepTwoOverflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    vertical: document.documentElement.scrollHeight - window.innerHeight
  }));
  expect(stepTwoOverflow.horizontal).toBeLessThanOrEqual(1);
  expect(stepTwoOverflow.vertical).toBeGreaterThan(0);
  const layoutRows = await page.locator("[data-layout]").evaluateAll((cards) => (
    cards
      .map((card) => card.getBoundingClientRect().top)
      .sort((a, b) => a - b)
      .reduce((rows, top) => {
        if (!rows.some((rowTop) => Math.abs(rowTop - top) <= 2)) rows.push(top);
        return rows;
      }, [])
  ));
  expect(layoutRows).toHaveLength(2);
  await expect(page.locator(".layout-illustration--sprite")).toHaveCount(0);
  const roomImages = page.locator(".layout-grid .layout-illustration img");
  await expect(roomImages).toHaveCount(10);
  await expect.poll(() => roomImages.evaluateAll((images) => (
    images.every((image) => (
      image.complete
      && image.naturalWidth > 0
      && new URL(image.currentSrc).pathname.endsWith(".avif")
    ))
  ))).toBe(true);
  const standaloneRoomPaths = await page.locator([
    '[data-layout="niche-layout"] img',
    '[data-layout="left-niche"] img',
    '[data-layout="right-niche"] img',
    '[data-layout="fireplace-wall"] img'
  ].join(",")).evaluateAll((images) => images.map((image) => new URL(image.currentSrc).pathname));
  expect(new Set(standaloneRoomPaths).size).toBe(4);

  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await expectMeasurementWorkspaceInOneScreen(page, "1280x720 Clear Wall Room & Size");

  await page.locator("[data-continue]").click();
  await expectOneScreenWorkspace(page, [
    ".customization-panel",
    ".concept-preview",
    ".customization-actions"
  ], "1280x720 Clear Wall Customization");
  await expectRoomPlusFurniturePreview(
    page.locator(".concept-preview"),
    resolvePreviewPresentation("bookcase", "cabinet-base-shelves", "clear-wall"),
    "assets/photos/configurator/room-layouts/room-clear-wall-v1.png"
  );

  for (const tab of ["Details", "Finish"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expectOneScreenWorkspace(page, [
      ".customization-panel",
      ".concept-preview",
      ".customization-actions"
    ], `1280x720 Clear Wall ${tab} tab`);
  }
});

test("product, finish, compatibility, preview, and review summary stay synchronized", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("132.25");
  await page.locator("[data-continue]").click();

  await expect(page.locator(".concept-preview")).toHaveAttribute("data-style", "cabinet-base-shelves");
  await expect(page.locator(".concept-preview")).toHaveAttribute(
    "data-preview-asset",
    "assets/photos/configurator/room-layouts/room-clear-wall-v1.png"
  );
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  const customizationPreview = page.locator(".concept-preview");
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(customizationPreview).toHaveAttribute("data-finish-family", "paint");
  await expect(customizationPreview.locator(".concept-finish-overlay")).toBeVisible();
  await expect(customizationPreview.locator(".concept-finish-overlay-tint")).toHaveCSS("fill", "rgb(52, 54, 56)");
  await expect(customizationPreview.locator(".concept-finish-caption")).toContainText("Charcoal");
  await expect(page.locator(".concept-unit")).toHaveCSS("--unit-finish", "#343638");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1.1");
  await page.getByRole("button", { name: "Reset preview" }).click();
  await expect(page.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1");

  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hardware" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Door style" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lighting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top treatment" })).toBeVisible();
  await page.locator('[data-detail-key="hardware"][data-detail="black-pull"]').click();
  await page.locator("[data-continue]").click();

  const summary = page.locator(".project-summary-card");
  await expect(summary).toContainText("Bookcase");
  await expect(summary).toContainText("Clear Wall");
  await expect(summary).toContainText("132 1/4 in");
  await expect(summary).toContainText("Cabinets + Shelves");
  await expect(summary).toContainText("Charcoal");
  await expect(summary).toContainText("Black Pull");
  await expect(page.locator(".concept-preview")).toHaveAttribute("data-finish", "charcoal");
  await expect(page.locator(".concept-finish-caption")).toContainText("Charcoal");
  await page.getByRole("button", { name: "Edit project notes" }).click();
  await page.getByLabel("Notes for our design team").fill("Keep the original picture rail.");
  await page.getByRole("button", { name: "Save Notes" }).click();
  await expect(summary.locator('[data-summary-value="notes"]')).toHaveText("Keep the original picture rail.");
  await expect(page.locator(".concept-preview")).toHaveAttribute("data-style", "cabinet-base-shelves");
});

test("automatic draft saving restores the active step and values after refresh", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Fireplace Wall");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("137 3/8");
  await page.locator('[data-measurement="fireplaceWidth"]').fill("45.5");
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await expect(page.locator('[data-measurement="wallWidth"]')).toHaveValue("137.38");
  await expect(page.locator('[data-measurement="fireplaceWidth"]')).toHaveValue("45.5");
  await page.goBack();
  await expect(page.getByRole("button", { name: /Fireplace Wall/ })).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(page.locator('[data-measurement="fireplaceWidth"]')).toHaveValue("45.5");
});

test("inspiration presets apply once and then restore edits after refresh", async ({ page }) => {
  await page.goto("/configurator.html?preset=media-wall", { waitUntil: "networkidle" });
  await expect(page.locator('[data-product-choice="tv-unit"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/configurator\.html#step-1$/);
  await page.locator("[data-continue]").click();
  await expect(page.locator('button[data-layout="clear-wall"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("129.5");
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await expect(page.locator('[data-measurement="wallWidth"]')).toHaveValue("129.5");
  await expect(page.locator('[data-measurement="tvScreenSize"]')).toBeVisible();
});

test("saved projects can be renamed, duplicated, deleted, and resumed", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Niche Layout");
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  const saveDialog = page.locator("[data-save-dialog]");
  await saveDialog.getByLabel("Project name").fill("Park Avenue Library");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();

  await page.getByRole("button", { name: "My Projects", exact: true }).click();
  const projectsDialog = page.locator("[data-projects-dialog]");
  await expect(projectsDialog.getByText("Park Avenue Library", { exact: true })).toBeVisible();
  await projectsDialog.getByRole("button", { name: "Duplicate Park Avenue Library" }).click();
  await expect(projectsDialog.locator(".saved-project")).toHaveCount(2);
  await projectsDialog.getByRole("button", { name: "Rename Park Avenue Library", exact: true }).click();
  await saveDialog.getByLabel("Project name").fill("Garden Library");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(projectsDialog.getByText("Garden Library", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await projectsDialog.getByRole("button", { name: "Delete Park Avenue Library Copy" }).click();
  await expect(projectsDialog.locator(".saved-project")).toHaveCount(1);
  await projectsDialog.getByRole("button", { name: "Resume Garden Library" }).click();
  await expect(page.getByRole("button", { name: /Niche Layout/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/project=JQ-/);
});

test("blocked local storage never reports a project as saved", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  const dialog = page.locator("[data-save-dialog]");
  await dialog.getByLabel("Project name").fill("Unsaved Library");
  await dialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator("[data-guided-toast]")).toContainText("couldn’t save this project");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqGuidedConfiguratorProjectsV1"))).toBeNull();
});

test("the static quote path validates contact details and honestly prepares an email", async ({ page }) => {
  await openFreshProject(page);
  await continueToReview(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();
  const dialog = page.locator("[data-quote-dialog]");
  await expect(dialog).toContainText("Online submission is not connected");
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-error]")).toContainText("required contact details");

  await fillQuoteContact(page);
  await dialog.locator('[name="photos"]').setInputFiles({
    name: "oversized-room.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1)
  });
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-error]")).toContainText("larger than 10 MB");
  await dialog.locator('[name="photos"]').setInputFiles([]);
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-mode]")).toContainText("email draft is ready");
  await expect(dialog.locator("[data-email-fallback]")).toHaveAttribute("href", /^mailto:info@jqwoodworking\.com/);
  await expect(dialog.locator("[data-email-fallback]")).toHaveAttribute("href", /JQ%20Project%20Quote%20Request/);
});

test("a connected quote endpoint shows a real success state and project reference", async ({ page }) => {
  await serveWithQuoteEndpoint(page, 200, { reference: "JQ-WEB-2607" });
  await openFreshProject(page);
  await continueToReview(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();
  const dialog = await fillQuoteContact(page);
  await dialog.getByRole("button", { name: "Send Quote Request" }).click();
  await expect(dialog.locator("[data-quote-success]")).toContainText("Your project request was sent.");
  await expect(dialog.locator("[data-quote-success]")).toContainText("JQ-WEB-2607");
  await expect(dialog.locator("[data-quote-success]")).toContainText("design team will review");
});

test("a failed connected quote request keeps the project and reports an honest error", async ({ page }) => {
  await serveWithQuoteEndpoint(page, 503, { error: "temporarily unavailable" });
  await openFreshProject(page);
  await continueToReview(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();
  const dialog = await fillQuoteContact(page);
  await dialog.getByRole("button", { name: "Send Quote Request" }).click();
  await expect(dialog.locator("[data-quote-error]")).toContainText("couldn’t send your request");
  await expect(dialog.locator("[data-quote-form]")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqGuidedConfiguratorDraftV1"))).not.toBeNull();
});

test("keyboard interaction covers product and layout cards, tabs, completed steps, and menu dismissal", async ({ page }) => {
  await openFreshProject(page);
  const firstProduct = page.locator('[data-product-choice="cabinet-shelves"]');
  await firstProduct.focus();
  await expect(firstProduct).toBeFocused();
  await page.keyboard.press("Space");
  await expect(firstProduct).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await expect(
    page.getByRole("heading", { name: "Choose the room condition that matches your space" })
  ).toBeFocused();

  const firstLayout = page.getByRole("button", { name: "Niche Layout", exact: true });
  await firstLayout.focus();
  await expect(firstLayout).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('button[data-layout="niche-layout"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await page.locator("[data-continue]").click();

  const finishTab = page.getByRole("tab", { name: "Finish" });
  await finishTab.focus();
  await finishTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /Choose Layout, completed/ }).click();
  await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();

  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Configurator menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Configurator menu" })).toBeHidden();
  await expect(menu).toBeFocused();
});

test("one complete guided flow works for every product category", async ({ page }) => {
  for (const product of products) {
    await openFreshProject(page);
    await continueToReview(page, sharedLayouts[0].label, product.label);
    await expect(page.locator(".project-summary-card")).toContainText(product.label);
    await expect(page.locator(".project-summary-card")).toContainText(sharedLayouts[0].label);
  }
});

test("all seventy product and room combinations render one exact truthful presentation", async ({ page }) => {
  test.slow();
  const runtime = monitorRuntime(page);

  for (const product of PRODUCT_CHOICES) {
    await openFreshProject(page);
    await page.locator(`[data-product-choice="${product.id}"]`).click();
    await page.locator("[data-continue]").click();

    for (const layout of SHARED_ROOM_LAYOUTS) {
      const expected = resolvePreviewPresentation(product.categoryId, product.styleId, layout.id);
      const expectedAsset = PRODUCT_INTEGRATED_PREVIEW_ASSETS[product.id][layout.id];

      await page.locator(`[data-layout="${layout.id}"]`).click();
      await page.locator("[data-continue]").click();
      const measurementRoom = page.locator(`.measurement-room[data-layout="${layout.id}"] img.measurement-room-image`);
      await expect.poll(() => measurementRoom.evaluate((image) => (
        image.complete && image.naturalWidth > 0 ? image.currentSrc : ""
      ))).not.toBe("");
      await page.locator("[data-continue]").click();

      const preview = page.locator(".concept-preview");
      await expect(preview).toHaveAttribute("data-category", product.categoryId);
      await expect(preview).toHaveAttribute("data-style", product.styleId);
      await expect(preview).toHaveAttribute("data-layout", layout.id);
      await expect(preview).toHaveAttribute("data-preview-key", expected.previewKey);
      await expect(preview).toHaveAttribute("data-authored-layout", layout.id);
      await expect(preview).toHaveAttribute("data-media-fit", expected.mediaFit);
      await expect(preview).toHaveAttribute("data-media-aspect-ratio", expected.mediaAspectRatio);
      await expect(preview).toHaveAttribute("data-media-position", expected.mediaObjectPosition);
      const layeredClearWall = product.categoryId === "bookcase" && layout.id === "clear-wall";
      expect(expected.renderMode, `${product.id}/${layout.id} presentation mode`).toBe(
        layeredClearWall ? "room-plus-furniture" : "integrated"
      );
      expect(
        layeredClearWall ? expected.furnitureAsset : expected.conceptAsset,
        `${product.id}/${layout.id} presentation asset`
      ).toBe(expectedAsset);
      expect(expected.authoredLayoutId, `${product.id}/${layout.id} authored topology`).toBe(layout.id);
      expect(expected.integratedLayoutId, `${product.id}/${layout.id} integrated topology`).toBe(layout.id);
      expect(expected.mediaFit, `${product.id}/${layout.id} media fit`).toBe("cover");
      expect(expected.mediaWidth, `${product.id}/${layout.id} media width`).toBeGreaterThan(0);
      expect(expected.mediaHeight, `${product.id}/${layout.id} media height`).toBeGreaterThan(0);
      expect(expected.mediaAspectRatio, `${product.id}/${layout.id} media ratio`).toBe(
        `${expected.mediaWidth} / ${expected.mediaHeight}`
      );
      expect(expected.mediaSvgPreserveAspectRatio, `${product.id}/${layout.id} SVG fit`).toMatch(
        /^x(?:Min|Mid|Max)Y(?:Min|Mid|Max) slice$/
      );
      expect(["asset", "inline"], `${product.id}/${layout.id} finish mask mode`).toContain(
        expected.finishMaskMode
      );
      expect(expected.finishMaskViewBox, `${product.id}/${layout.id} finish mask viewBox`).toBe(
        `0 0 ${expected.finishMaskWidth} ${expected.finishMaskHeight}`
      );
      expect(expected.finishMaskWidth, `${product.id}/${layout.id} finish mask width`).toBe(
        expected.mediaWidth
      );
      expect(expected.finishMaskHeight, `${product.id}/${layout.id} finish mask height`).toBe(
        expected.mediaHeight
      );
      if (layeredClearWall) {
        await expectRoomPlusFurniturePreview(preview, expected, layout.previewAsset);
      } else {
        await expectIntegratedPreview(preview, expectedAsset);
      }
      const maskImage = preview.locator("svg.concept-finish-overlay mask image");
      if (expected.finishMaskMode === "asset") {
        await expect(maskImage).toHaveCount(1);
        await expect(maskImage).toHaveAttribute("href", expected.finishMaskAsset);
      } else {
        await expect(maskImage).toHaveCount(0);
        expect(expected.finishMaskAsset).toBeNull();
      }

      await page.getByRole("button", { name: /Choose Layout, completed/ }).click();
    }
  }

  expect(runtime.filter((failure) => !failure.includes("net::ERR_ABORTED"))).toEqual([]);
});

test("desktop, iPad, and phone layouts are overflow-free with usable mobile controls", async ({ page }) => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1180, height: 820 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await openFreshProject(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(1);
  }

  const productTargets = await page.locator("[data-product-choice]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(Math.min(...productTargets)).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".guided-step-label--mobile")).toHaveText(["Product", "Layout", "Size", "Finish", "Review"]);
  await continueToLayouts(page, "Radiator Cover");
  await expect(page.locator(".guided-category-nav")).toHaveCount(0);
  await expect(page.locator(".layout-grid")).toHaveCSS("grid-template-columns", /.+ .+/);
  const cardTargets = await page.locator("[data-layout]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(Math.min(...cardTargets)).toBeGreaterThanOrEqual(44);
  await chooseLayout(page, "Window Wall");
  await page.locator("[data-continue]").click();
  await expect(page.locator("[data-dimension-chip]")).toHaveCount(2);
  expect(await page.locator("[data-dimension-chip]").evaluateAll((chips) => (
    chips.map((chip) => chip.dataset.dimensionChip)
  ))).toEqual(["wallWidth", "ceilingHeight"]);
  const mobileOrder = await page.evaluate(() => {
    const diagram = document.querySelector(".measurement-diagram-card").getBoundingClientRect();
    const form = document.querySelector(".measurement-panel").getBoundingClientRect();
    const actions = document.querySelector(".guided-actions");
    const information = document.querySelector(".guided-info").getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const style = getComputedStyle(actions);
    return {
      diagramBeforeForm: diagram.top < form.top,
      actionsPosition: style.position,
      actionsBottom: style.bottom,
      actionsFollowContent: actionsRect.top >= information.bottom - 1
    };
  });
  expect(mobileOrder.diagramBeforeForm).toBe(true);
  expect(mobileOrder.actionsPosition).toBe("static");
  expect(mobileOrder.actionsBottom).toBe("auto");
  expect(mobileOrder.actionsFollowContent).toBe(true);
  await expectNoHorizontalOverflow(page, [
    ".measurement-panel",
    ".measurement-diagram-card",
    ".guided-info",
    ".guided-actions"
  ]);
  await page.screenshot({ path: "test-results/guided-configurator-phone.png", fullPage: true });
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await expectNoHorizontalOverflow(page, [
    ".customization-panel",
    ".concept-preview",
    ".customization-actions"
  ]);

  await page.setViewportSize({ width: 1280, height: 720 });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.locator("[data-continue]").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "1280x720 customization").toBeLessThanOrEqual(1);
  await page.locator("[data-continue]").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "1280x720 review").toBeLessThanOrEqual(1);
});
