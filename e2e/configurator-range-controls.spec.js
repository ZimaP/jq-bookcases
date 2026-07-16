import { test, expect } from "@playwright/test";

async function openConfigurator(page, preset = "classic-open") {
  await page.goto(`/configurator.html?preset=${encodeURIComponent(preset)}`, { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
}

async function openStage(page, stage) {
  const trigger = page.locator(`[data-workspace-stage="${stage}"]`);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-current", "location");
}

function rangeControl(page, field) {
  return page.locator(
    `[data-properties-inspector] [data-range-control="${field}"] input[type="range"][data-field="${field}"]`
  );
}

function numberControl(page, field) {
  return page.locator(
    `[data-properties-inspector] [data-range-control="${field}"] input[type="number"][data-field="${field}"]`
  );
}

async function readInteractionState(page) {
  return page.locator("[data-bookcase-builder]").evaluate((host) => {
    const configurator = host.__bookcaseConfigurator;
    const diagnostics = configurator.getDiagnostics();
    return {
      state: diagnostics.state,
      history: diagnostics.history,
      activeRangeDrag: Boolean(configurator.activeRangeDrag),
      renderValid: diagnostics.viewer.renderAudit.valid,
      canvasCount: diagnostics.canvasCount
    };
  });
}

async function settleRangeFrame(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
}

async function readRangeTravelLane(range) {
  return range.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const thumbSize = Number.parseFloat(getComputedStyle(element).getPropertyValue("--range-thumb-size"));
    const resolvedThumbSize = Number.isFinite(thumbSize) && thumbSize > 0 ? thumbSize : 20;
    return {
      left: rect.left + resolvedThumbSize / 2,
      right: rect.right - resolvedThumbSize / 2,
      width: rect.width - resolvedThumbSize
    };
  });
}

async function dragRange(page, field, targetRatio, expectedValue) {
  const range = rangeControl(page, field);
  await expect(range).toBeVisible();
  await range.scrollIntoViewIfNeeded();
  const box = await range.boundingBox();
  expect(box).not.toBeNull();

  const min = Number(await range.getAttribute("min"));
  const max = Number(await range.getAttribute("max"));
  const startValue = Number(await range.inputValue());
  const startRatio = (startValue - min) / (max - min);
  const marker = `drag-${field}-${Date.now()}`;
  await range.evaluate((element, value) => {
    element.dataset.dragProbe = value;
  }, marker);

  const travelLane = await readRangeTravelLane(range);
  const startX = travelLane.left + travelLane.width * startRatio;
  const endX = travelLane.left + travelLane.width * targetRatio;
  const y = box.y + box.height / 2;
  const historyBefore = (await readInteractionState(page)).history.undo;
  const samples = [];

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await expect(page.locator(`[data-drag-probe="${marker}"]`)).toHaveCount(1);
  await expect(range.locator("xpath=..")).toHaveClass(/is-dragging/);

  for (let index = 1; index <= 8; index += 1) {
    const progress = index / 8;
    await page.mouse.move(startX + (endX - startX) * progress, y);
    await settleRangeFrame(page);
    samples.push(Number(await range.inputValue()));
    await expect(page.locator(`[data-drag-probe="${marker}"]`)).toHaveCount(1);
  }

  await page.mouse.up();
  await expect.poll(async () => (await readInteractionState(page)).state[field]).toBe(expectedValue);
  await expect(range).toHaveValue(String(expectedValue));
  await expect(numberControl(page, field)).toHaveValue(String(expectedValue));
  await expect(page.locator(`[data-drag-probe="${marker}"]`)).toHaveCount(0);

  const completed = await readInteractionState(page);
  expect(completed.activeRangeDrag).toBe(false);
  expect(completed.history.undo).toBe(historyBefore + 1);
  expect(completed.renderValid).toBe(true);
  expect(completed.canvasCount).toBe(1);
  expect(new Set(samples).size).toBeGreaterThanOrEqual(3);
  expect(samples).not.toContain(max);
}

test("all dimension and shelf ranges drag smoothly without replacing the active control", async ({ page }) => {
  await openConfigurator(page);

  const scenarios = [
    { stage: "space", field: "width", ratio: 0.8, expected: 120 },
    { stage: "space", field: "height", ratio: 0.25, expected: 84 },
    { stage: "space", field: "depth", ratio: 10 / 14, expected: 20 },
    { stage: "storage", field: "shelfThickness", ratio: 0.8, expected: 1.75 }
  ];

  for (const scenario of scenarios) {
    await openStage(page, scenario.stage);
    await dragRange(page, scenario.field, scenario.ratio, scenario.expected);
  }

  const beforeUndo = await readInteractionState(page);
  await page.locator("[data-history-undo]").click();
  await expect.poll(async () => (await readInteractionState(page)).state.shelfThickness).toBe(1.25);
  await page.locator("[data-history-redo]").click();
  await expect.poll(async () => (await readInteractionState(page)).state.shelfThickness).toBe(1.75);
  expect((await readInteractionState(page)).history.undo).toBe(beforeUndo.history.undo);
});

test("range click-to-jump and keyboard arrows remain synchronized and focused", async ({ page }) => {
  await openConfigurator(page);
  await openStage(page, "space");

  const depth = rangeControl(page, "depth");
  const box = await depth.boundingBox();
  expect(box).not.toBeNull();
  const historyBefore = (await readInteractionState(page)).history.undo;
  const travelLane = await readRangeTravelLane(depth);

  await depth.click({
    position: {
      x: travelLane.left - box.x + travelLane.width * 0.25,
      y: box.height / 2
    }
  });
  await expect.poll(async () => (await readInteractionState(page)).state.depth).toBe(14);
  await expect(depth).toHaveValue("14");
  await expect(numberControl(page, "depth")).toHaveValue("14");

  await depth.press("ArrowRight");
  await settleRangeFrame(page);
  await expect.poll(async () => (await readInteractionState(page)).state.depth).toBe(15);
  await expect(depth).toBeFocused();
  await expect(numberControl(page, "depth")).toHaveValue("15");

  const completed = await readInteractionState(page);
  expect(completed.history.undo).toBe(historyBefore + 2);
  expect(completed.activeRangeDrag).toBe(false);
  expect(completed.renderValid).toBe(true);
});

test("range thumb press is stable and both travel-lane endpoints remain reachable", async ({ page }) => {
  await openConfigurator(page);
  await openStage(page, "space");

  const width = rangeControl(page, "width");
  await width.scrollIntoViewIfNeeded();
  const min = Number(await width.getAttribute("min"));
  const max = Number(await width.getAttribute("max"));
  const initialValue = Number(await width.inputValue());
  const initialRatio = (initialValue - min) / (max - min);
  const initialLane = await readRangeTravelLane(width);
  const initialThumbX = initialLane.left + initialLane.width * initialRatio;
  const initialBox = await width.boundingBox();
  expect(initialBox).not.toBeNull();
  const y = initialBox.y + initialBox.height / 2;
  const historyBefore = (await readInteractionState(page)).history.undo;

  await page.mouse.move(initialThumbX, y);
  await page.mouse.down();
  await settleRangeFrame(page);
  await expect.poll(async () => (await readInteractionState(page)).state.width).toBe(initialValue);
  await expect(width).toHaveValue(String(initialValue));
  expect((await readInteractionState(page)).history.undo).toBe(historyBefore);
  await page.mouse.up();

  const laneToMinimum = await readRangeTravelLane(width);
  const boxToMinimum = await width.boundingBox();
  expect(boxToMinimum).not.toBeNull();
  const currentThumbX = laneToMinimum.left + laneToMinimum.width * initialRatio;
  await page.mouse.move(currentThumbX, boxToMinimum.y + boxToMinimum.height / 2);
  await page.mouse.down();
  await page.mouse.move(laneToMinimum.left, boxToMinimum.y + boxToMinimum.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await readInteractionState(page)).state.width).toBe(min);
  await expect(width).toHaveValue(String(min));

  const laneToMaximum = await readRangeTravelLane(width);
  const boxToMaximum = await width.boundingBox();
  expect(boxToMaximum).not.toBeNull();
  await page.mouse.move(laneToMaximum.left, boxToMaximum.y + boxToMaximum.height / 2);
  await page.mouse.down();
  await page.mouse.move(laneToMaximum.right, boxToMaximum.y + boxToMaximum.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await readInteractionState(page)).state.width).toBe(max);
  await expect(width).toHaveValue(String(max));

  const completed = await readInteractionState(page);
  expect(completed.history.undo).toBe(historyBefore + 2);
  expect(completed.activeRangeDrag).toBe(false);
  expect(completed.renderValid).toBe(true);
});

test("section Storage adjustments preserve keyboard focus and reject invalid typed values", async ({ page }) => {
  await openConfigurator(page, "lower-cabinets");
  await openStage(page, "storage");

  const sectionConfig = (index = 0) => page.locator("[data-bookcase-builder]").evaluate((host, sectionIndex) => (
    host.__bookcaseConfigurator.getDiagnostics().state.layoutMetadata?.sectionConfigs?.[sectionIndex] || null
  ), index);
  const shelfNumber = () => page.locator(
    '[data-properties-inspector] input[type="number"][data-section-storage-field="shelfCount"]'
  );
  const increaseShelves = () => page.locator(
    '[data-properties-inspector] button[data-section-storage-step="shelfCount"][data-step-direction="1"]'
  );

  const initialShelfCount = (await sectionConfig()).shelfCount;
  await increaseShelves().focus();
  await increaseShelves().press("Enter");
  await expect.poll(async () => (await sectionConfig()).shelfCount).toBe(initialShelfCount + 1);
  await expect(increaseShelves()).toBeFocused();

  const acceptedShelfCount = (await sectionConfig()).shelfCount;
  await shelfNumber().fill("");
  await shelfNumber().press("Enter");
  await expect(shelfNumber()).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('[data-section-storage-error="shelfCount"]')).toContainText("between 0 and 8");
  expect((await sectionConfig()).shelfCount).toBe(acceptedShelfCount);
  await expect(shelfNumber()).toHaveValue("");
  await expect(shelfNumber()).toBeFocused();

  await shelfNumber().fill("3.5");
  await shelfNumber().press("Enter");
  await expect(shelfNumber()).toHaveAttribute("aria-invalid", "true");
  expect((await sectionConfig()).shelfCount).toBe(acceptedShelfCount);

  await shelfNumber().fill("9");
  await shelfNumber().press("Enter");
  await expect(shelfNumber()).toHaveAttribute("aria-invalid", "true");
  expect((await sectionConfig()).shelfCount).toBe(acceptedShelfCount);

  await shelfNumber().fill("6");
  await shelfNumber().press("Enter");
  await expect.poll(async () => (await sectionConfig()).shelfCount).toBe(6);
  await expect(shelfNumber()).not.toHaveAttribute("aria-invalid", "true");
  await expect(shelfNumber()).toBeFocused();

  const doorStyle = () => page.locator(
    '[data-properties-inspector] select[data-section-storage-field="doorStyle"]'
  );
  const currentDoorStyle = await doorStyle().inputValue();
  const nextDoorStyle = currentDoorStyle === "flat" ? "shaker" : "flat";
  await doorStyle().focus();
  await doorStyle().selectOption(nextDoorStyle);
  await expect.poll(async () => (await sectionConfig()).doorStyle).toBe(nextDoorStyle);
  await expect(doorStyle()).toBeFocused();

  const openShelvesPreset = () => page.locator(
    '[data-properties-inspector] input[type="radio"][data-section-storage-preset="open_shelves"]'
  );
  await openShelvesPreset().focus();
  await openShelvesPreset().press("Space");
  await expect.poll(async () => (await sectionConfig()).type).toBe("open");
  await expect(openShelvesPreset()).toBeChecked();
  await expect(openShelvesPreset()).toBeFocused();

  const nextSection = () => page.locator(
    '[data-properties-inspector] button[data-storage-section-step="1"]'
  );
  await nextSection().focus();
  await nextSection().press("Enter");
  await expect(page.locator("[data-properties-inspector] [data-storage-console] h3").first()).toContainText("Section 2 of");
  await expect(nextSection()).toBeFocused();
});

test.describe("touch range interaction", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 900 } });

  test("horizontal touch dragging keeps the range active without scrolling the Properties sheet", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CDP touch input is Chromium-specific");
    const client = await page.context().newCDPSession(page);

    await openConfigurator(page);
    await openStage(page, "space");
    const width = rangeControl(page, "width");
    await width.scrollIntoViewIfNeeded();
    const box = await width.boundingBox();
    expect(box).not.toBeNull();

    const geometry = await width.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        touchAction: style.touchAction
      };
    });
    expect(geometry.height).toBeGreaterThanOrEqual(44);
    expect(geometry.touchAction).toBe("pan-y");

    const controlsScroll = page.locator("[data-controls-scroll]");
    const scrollBefore = await controlsScroll.evaluate((element) => element.scrollTop);
    const historyBefore = (await readInteractionState(page)).history.undo;
    const travelLane = await readRangeTravelLane(width);
    const startX = travelLane.left + travelLane.width * 0.6;
    const endX = travelLane.left + travelLane.width * 0.8;
    const y = box.y + box.height / 2;
    const point = (x) => ({
      x: Math.round(x),
      y: Math.round(y),
      radiusX: 4,
      radiusY: 4,
      force: 1,
      id: 1
    });

    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(startX)] });
    for (let index = 1; index <= 6; index += 1) {
      const x = startX + (endX - startX) * (index / 6);
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(x)] });
      await settleRangeFrame(page);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect.poll(async () => (await readInteractionState(page)).state.width).toBe(120);
    const completed = await readInteractionState(page);
    const scrollAfter = await controlsScroll.evaluate((element) => element.scrollTop);
    expect(completed.history.undo).toBe(historyBefore + 1);
    expect(completed.activeRangeDrag).toBe(false);
    expect(completed.renderValid).toBe(true);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(1);
  });
});
