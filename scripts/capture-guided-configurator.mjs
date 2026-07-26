import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.GUIDED_CAPTURE_BASE_URL || "http://127.0.0.1:5197";
const outputDirectory = resolve("artifacts/guided-configurator-qa");

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce"
});
const page = await context.newPage();

const runtimeFailures = [];
page.on("pageerror", (error) => runtimeFailures.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") runtimeFailures.push(`console: ${message.text()}`);
});
page.on("requestfailed", (request) => {
  runtimeFailures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`);
});

async function waitForHeading(name) {
  await page.getByRole("heading", { name }).waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
}

async function capture(filename, { fullPage = true } = {}) {
  await page.screenshot({
    path: resolve(outputDirectory, filename),
    fullPage,
    animations: "disabled"
  });
}

async function chooseExactButton(name) {
  await page.getByRole("button", { name, exact: true }).click();
}

try {
  await page.goto(`${baseUrl}/configurator.html?start=new`, { waitUntil: "networkidle" });
  await waitForHeading("Choose the layout that matches your space");
  await capture("desktop-step-1-layout.png");

  await chooseExactButton("Window Wall");
  await page.locator("[data-continue]").click();
  await waitForHeading("Tell us about your space");
  await page.getByLabel("Wall width").fill("158");
  await page.getByLabel("Ceiling height").fill("106");
  await page.getByLabel("Window width").fill("48");
  await page.getByLabel("Window height").fill("36");
  await page.getByLabel("Sill height").fill("30");
  await capture("desktop-step-2-room-size.png");

  await page.locator("[data-continue]").click();
  await waitForHeading("Refine your concept");
  await chooseExactButton("Lower Cabinets + Shelves");
  await capture("desktop-step-3-customization.png");

  await page.getByRole("tab", { name: "Finish" }).click();
  await chooseExactButton("Natural Oak");
  await chooseExactButton("Warm Linen");
  await page.getByRole("tab", { name: "Details" }).click();
  await page.locator('button[data-detail="shaker"]').click();
  await page.locator('button[data-detail="brass-pull"]').click();
  await page.locator('button[data-detail="warm-led"]').click();
  await page.locator('button[data-detail="flush-base"]').click();
  await page.locator('button[data-detail="small-crown"]').click();
  await page.locator("[data-continue]").click();
  await waitForHeading("Review your custom concept");
  await page.getByLabel("Notes for our design team").fill("Preserve the existing window trim and align the lower cabinet rails with the sill.");
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture("desktop-step-4-review.png", { fullPage: false });

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.getByRole("button", { name: /Customization, completed/ }).click();
  await waitForHeading("Refine your concept");
  await page.getByRole("tab", { name: "Finish" }).click();
  await capture("tablet-landscape-customization.png");

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole("button", { name: /Room & Size, completed/ }).click();
  await waitForHeading("Tell us about your space");
  await capture("tablet-portrait-room-size.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Choose Layout, completed/ }).click();
  await waitForHeading("Choose the layout that matches your space");
  await capture("mobile-step-1-layout.png", { fullPage: false });

  await page.getByRole("button", { name: /Customization, completed/ }).click();
  await waitForHeading("Refine your concept");
  await page.getByRole("tab", { name: "Style" }).click();
  await capture("mobile-step-3-customization.png", { fullPage: false });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) runtimeFailures.push(`mobile overflow: ${overflow}px`);
} finally {
  await context.close();
  await browser.close();
}

if (runtimeFailures.length) {
  throw new Error(`Capture runtime failures:\n${runtimeFailures.join("\n")}`);
}

console.log(`Captured 8 guided configurator screenshots in ${outputDirectory}`);
