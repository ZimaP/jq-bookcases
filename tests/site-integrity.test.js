import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicPages = [
  "index.html",
  "configurator.html",
  "how-it-works.html",
  "materials.html",
  "inspiration.html",
  "about.html",
  "faq.html",
  "request-quote.html",
  "privacy.html",
  "terms.html",
];

const pageSource = new Map(
  publicPages.map((file) => [file, readFileSync(path.join(rootDir, file), "utf8")]),
);
const siteSource = readFileSync(path.join(rootDir, "site.js"), "utf8");
const quotePrefillSource = readFileSync(path.join(rootDir, "quote-prefill.js"), "utf8");
const configuratorSource = readFileSync(
  path.join(rootDir, "configurator-3d.js"),
  "utf8",
);
const productionWorkflowSource = readFileSync(
  path.join(rootDir, ".github", "workflows", "deploy-pages-production.yml"),
  "utf8",
);
const packageSource = readFileSync(path.join(rootDir, "package.json"), "utf8");
const playwrightConfigSource = readFileSync(path.join(rootDir, "playwright.config.js"), "utf8");
const configuratorBrowserTestSource = readFileSync(
  path.join(rootDir, "e2e", "bookcase-configurator.spec.js"),
  "utf8",
);

function matches(text, pattern) {
  return Array.from(text.matchAll(pattern));
}

function tags(html, tagName) {
  return matches(html, new RegExp("<" + tagName + "\\b[^>]*>", "gi")).map(
    (match) => match[0],
  );
}

function attribute(tag, name) {
  const match = tag.match(
    new RegExp(
      "\\b" + name + "\\s*=\\s*(?:([\\\"'])([\\s\\S]*?)\\1|([^\\s\\\"'=<>]+))",
      "i",
    ),
  );
  return match ? match[2] ?? match[3] : null;
}

function hasClass(tag, className) {
  const value = attribute(tag, "class");
  return value ? value.split(/\s+/).includes(className) : false;
}

function normalizedText(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function attributeCount(html, name) {
  const attributePattern = new RegExp(
    "\\b" + name + "(?=\\s*=|\\s|/?>)",
    "i",
  );
  return matches(html, /<[a-z][^>]*>/gi).filter((match) =>
    attributePattern.test(match[0]),
  ).length;
}

function sharedAssetUrl(html, tagName, attrName, assetName) {
  return tags(html, tagName)
    .map((tag) => attribute(tag, attrName))
    .filter(Boolean)
    .filter((url) => url.split(/[?#]/, 1)[0] === assetName);
}

function cacheToken(url) {
  return new URL(url, "https://jq-bookcases.test/").searchParams.get("v");
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'");
}

function collectReferences(sourceName, source) {
  const references = [];
  const tagPattern = /<[a-z][^>]*>/gi;

  for (const match of source.matchAll(tagPattern)) {
    for (const attrName of ["href", "src"]) {
      const rawValue = attribute(match[0], attrName);
      if (!rawValue || rawValue.includes("${")) continue;
      references.push({
        sourceName,
        attrName,
        value: decodeHtmlAttribute(rawValue.trim()),
      });
    }
  }

  return references;
}

function collectScriptReferences(sourceName, source) {
  const references = collectReferences(sourceName, source);
  const literalPatterns = [
    /\bhref\s*:\s*([\"'])([^\"']+)\1/gi,
    /\b(?:const|let|var)\s+\w*(?:Href|Src)\s*=\s*([\"'])([^\"']+)\1/gi,
    /\.(?:href|src)\s*=\s*([\"'])([^\"']+)\1/gi,
    /setAttribute\(\s*([\"'])(?:href|src)\1\s*,\s*([\"'])([^\"']+)\2\s*\)/gi,
  ];

  for (const pattern of literalPatterns) {
    for (const match of source.matchAll(pattern)) {
      const value = match.at(-1);
      references.push({ sourceName, attrName: "injected href/src", value });
    }
  }

  return references;
}

function localReference(reference) {
  const value = reference.value;
  if (
    !value ||
    value.startsWith("//") ||
    /^(?:data|javascript|mailto|sms|tel):/i.test(value) ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    return null;
  }

  const hashIndex = value.indexOf("#");
  const fragment = hashIndex === -1 ? "" : value.slice(hashIndex + 1);
  const beforeHash = hashIndex === -1 ? value : value.slice(0, hashIndex);
  const pathname = beforeHash.split("?", 1)[0];
  const sourceDirectory = path.dirname(path.join(rootDir, reference.sourceName));
  const targetPath = pathname
    ? pathname.startsWith("/")
      ? path.resolve(rootDir, "." + pathname)
      : path.resolve(sourceDirectory, pathname)
    : path.join(rootDir, reference.sourceName);

  return { fragment: decodeURIComponent(fragment), targetPath };
}

test("the root exposes exactly the canonical public page set", () => {
  const actualPages = readdirSync(rootDir)
    .filter((file) => file.endsWith(".html"))
    .sort();
  const expectedPages = [...publicPages].sort();

  assert.deepEqual(actualPages, expectedPages);
  assert.equal(existsSync(path.join(rootDir, "contact.html")), false);
});

test("every canonical page satisfies the shared accessibility and metadata contract", async (t) => {
  const titles = [];
  const descriptions = [];
  const pageNames = [];

  for (const file of publicPages) {
    await t.test(file, () => {
      const html = pageSource.get(file);
      const htmlTag = tags(html, "html");
      const titleTags = matches(html, /<title\b[^>]*>([\s\S]*?)<\/title>/gi);
      const descriptionTags = tags(html, "meta").filter(
        (tag) => (attribute(tag, "name") || "").toLowerCase() === "description",
      );
      const bodyTags = tags(html, "body");
      const anchors = tags(html, "a");
      const mainTags = tags(html, "main").filter(
        (tag) => attribute(tag, "id") === "main",
      );

      assert.match(html, /^\s*<!doctype html>/i, file + " must start with an HTML doctype");
      assert.equal(htmlTag.length, 1, file + " must have one html element");
      assert.ok(attribute(htmlTag[0], "lang")?.trim(), file + " must declare a language");

      assert.equal(titleTags.length, 1, file + " must have one title");
      const title = normalizedText(titleTags[0][1]);
      assert.ok(title, file + " must have a non-empty title");
      titles.push([file, title]);

      assert.equal(descriptionTags.length, 1, file + " must have one meta description");
      const description = attribute(descriptionTags[0], "content")?.trim();
      assert.ok(description, file + " must have a non-empty meta description");
      descriptions.push([file, description]);

      assert.equal(bodyTags.length, 1, file + " must have one body element");
      const pageName = attribute(bodyTags[0], "data-page")?.trim();
      assert.ok(pageName, file + " must identify itself with body[data-page]");
      pageNames.push([file, pageName]);

      const skipLinks = anchors.filter(
        (tag) => hasClass(tag, "skip-link") && attribute(tag, "href") === "#main",
      );
      assert.equal(skipLinks.length, 1, file + " must have one skip link to #main");
      assert.equal(mainTags.length, 1, file + " must have one main#main landmark");
      assert.equal(
        attributeCount(html, "data-site-header"),
        1,
        file + " must have one shared header host",
      );
      assert.equal(
        attributeCount(html, "data-site-footer"),
        1,
        file + " must have one shared footer host; it may be visually hidden on the configurator",
      );

      const ids = matches(html, /\bid\s*=\s*([\"'])([^\"']+)\1/gi).map(
        (match) => match[2],
      );
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      assert.deepEqual(
        [...new Set(duplicateIds)],
        [],
        file + " must not contain duplicate static IDs",
      );

      for (const imageTag of tags(html, "img")) {
        assert.ok(
          attribute(imageTag, "alt")?.trim(),
          file + " contains an image without meaningful alt text: " + imageTag,
        );
      }

      const staticHeadingCount = matches(html, /<h1\b[^>]*>/gi).length;
      if (file === "configurator.html" && staticHeadingCount === 0) {
        assert.equal(
          attributeCount(html, "data-bookcase-builder"),
          1,
          "configurator.html must provide one dynamic builder host when its h1 is rendered by JavaScript",
        );
        assert.match(
          configuratorSource,
          /<h1\b/i,
          "configurator-3d.js must document the configurator's dynamic h1 in its rendered template",
        );
      } else {
        assert.equal(staticHeadingCount, 1, file + " must have exactly one h1");
      }
    });
  }

  function assertUnique(values, label) {
    const byValue = new Map();
    for (const [file, value] of values) {
      const key = normalizedText(value).toLowerCase();
      byValue.set(key, [...(byValue.get(key) || []), file]);
    }
    const duplicates = [...byValue.values()].filter((files) => files.length > 1);
    assert.deepEqual(duplicates, [], label + " must be unique across canonical pages");
  }

  assertUnique(titles, "Titles");
  assertUnique(descriptions, "Meta descriptions");
  assertUnique(pageNames, "data-page values");
});

test("every public page provides navigation when JavaScript is unavailable", () => {
  for (const [file, html] of pageSource) {
    assert.match(html, /<noscript>[\s\S]*aria-label="Primary navigation without JavaScript"[\s\S]*<\/noscript>/, file);
    assert.match(html, /The 3D configurator and interactive controls require JavaScript/, file);
  }
});

test("public images reserve intrinsic space to avoid layout shifts", () => {
  for (const [file, html] of pageSource) {
    for (const imageTag of tags(html, "img")) {
      assert.ok(attribute(imageTag, "width"), `${file} image is missing width: ${imageTag}`);
      assert.ok(attribute(imageTag, "height"), `${file} image is missing height: ${imageTag}`);
    }
  }
});

test("all pages load the shared stylesheet and site script with one cache token", () => {
  const tokens = [];

  for (const file of publicPages) {
    const html = pageSource.get(file);
    const stylesheetUrls = sharedAssetUrl(html, "link", "href", "styles.css");
    const scriptUrls = sharedAssetUrl(html, "script", "src", "site.js");

    assert.equal(stylesheetUrls.length, 1, file + " must include styles.css exactly once");
    assert.equal(scriptUrls.length, 1, file + " must include site.js exactly once");

    const stylesheetToken = cacheToken(stylesheetUrls[0]);
    const scriptToken = cacheToken(scriptUrls[0]);
    assert.ok(stylesheetToken, file + " styles.css must have a cache token");
    assert.ok(scriptToken, file + " site.js must have a cache token");
    assert.equal(
      stylesheetToken,
      scriptToken,
      file + " must use the same cache token for styles.css and site.js",
    );
    tokens.push(stylesheetToken);
  }

  assert.equal(new Set(tokens).size, 1, "all canonical pages must use the same shared cache token");
});

test("every non-configurator route loads the bright showroom color layer", () => {
  for (const file of publicPages) {
    const html = pageSource.get(file);
    const themeUrls = sharedAssetUrl(html, "link", "href", "bright-theme.css");

    if (file === "configurator.html") {
      assert.equal(themeUrls.length, 0, "the configurator must retain its dedicated color system");
      continue;
    }

    assert.equal(themeUrls.length, 1, file + " must include bright-theme.css exactly once");
    assert.ok(cacheToken(themeUrls[0]), file + " bright-theme.css must have a cache token");
  }
});

test("every static local href, src, and HTML fragment resolves", () => {
  const references = [
    ...[...pageSource].flatMap(([file, html]) => collectReferences(file, html)),
    ...collectScriptReferences("site.js", siteSource),
  ];

  for (const reference of references) {
    const local = localReference(reference);
    if (!local) continue;

    assert.ok(
      local.targetPath === rootDir || local.targetPath.startsWith(rootDir + path.sep),
      reference.sourceName + " contains a local reference outside the project: " + reference.value,
    );
    assert.ok(
      existsSync(local.targetPath),
      reference.sourceName + " contains a missing " + reference.attrName + ": " + reference.value,
    );

    if (local.fragment && path.extname(local.targetPath).toLowerCase() === ".html") {
      const targetHtml = readFileSync(local.targetPath, "utf8");
      const targetIds = new Set(
        matches(targetHtml, /\bid\s*=\s*([\"'])([^\"']+)\1/gi).map(
          (match) => match[2],
        ),
      );
      assert.ok(
        targetIds.has(local.fragment),
        reference.sourceName + " contains an unresolved fragment: " + reference.value,
      );
    }
  }
});

test("public sources contain no retired routes, newsletter UI, or fake backend copy", () => {
  const publicSource = [...pageSource.values(), siteSource].join("\n");
  const forbidden = [
    [/#design-builder/i, "the retired design-builder fragment"],
    [/contact\.html/i, "the retired contact page"],
    [/newsletter/i, "newsletter UI or behavior"],
    [/final submission connection/i, "placeholder submission copy"],
    [/\bbackend\b/i, "placeholder backend copy"],
    [/fake backend/i, "fake-backend copy"],
  ];

  for (const [pattern, label] of forbidden) {
    assert.doesNotMatch(publicSource, pattern, "public sources still contain " + label);
  }
});

test("every public page uses the shared JQ Bookcases lockup and canonical product vocabulary", () => {
  const publicSource = [...pageSource.values(), siteSource, configuratorSource].join("\n");

  for (const [file, html] of pageSource) {
    const title = normalizedText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
    assert.match(title, /JQ Bookcases/, file + " title must use the canonical brand name");
  }

  assert.match(pageSource.get("configurator.html"), /3D Bookcase Configurator/);
  assert.match(siteSource, /shortName: "JQ Bookcases"/);
  assert.match(siteSource, /initials: "JQ"/);
  assert.match(siteSource, /name: "BOOKCASES"/);
  assert.match(siteSource, /descriptor: "BUILT-INS & MILLWORK"/);
  assert.match(siteSource, /class="brand-mark"/);
  assert.match(siteSource, /class="brand-copy"/);
  assert.match(siteSource, /aria-label="\$\{officialBrand\.shortName\} home"/);
  assert.doesNotMatch(publicSource, /John Quinn Bookcases|JOHN QUINN/);

  const retiredVocabulary = [
    [/\bJQ Woodworking\b/i, "JQ Woodworking"],
    [/\bBookcase Builder\b/i, "Bookcase Builder"],
    [/\bBookcase Specifier\b/i, "Bookcase Specifier"],
    [/\bDesign Yours\b/i, "Design Yours"],
  ];

  for (const [pattern, label] of retiredVocabulary) {
    assert.doesNotMatch(publicSource, pattern, "public sources still contain noncanonical wording: " + label);
  }
});

test("canonical design and quote routes have inbound links", () => {
  const references = [
    ...[...pageSource].flatMap(([file, html]) => collectReferences(file, html)),
    ...collectScriptReferences("site.js", siteSource),
  ];

  for (const route of ["configurator.html", "request-quote.html"]) {
    const inbound = references.filter((reference) => {
      const local = localReference(reference);
      if (!local) return false;
      return (
        path.basename(local.targetPath) === route &&
        path.basename(reference.sourceName) !== route
      );
    });

    assert.ok(inbound.length > 0, route + " must have an inbound link from another public source");
  }
});

test("custom saved designs retain their structural layout in the quote handoff", () => {
  const structuralMappings = [
    ["lower_cabinets", "lower-cabinets"],
    ["classic", "classic-open"],
    ["media_wall", "media-wall"],
    ["library", "library-wall"],
    ["display_wall", "display-wall"],
    ["glass_library", "glass-library"],
    ["desk_niche", "desk-niche"],
    ["feature_wall", "feature-wall"],
    ["asymmetric", "asymmetric-modern"],
    ["tall_storage", "tall-storage"],
  ];

  for (const [layoutType, presetId] of structuralMappings) {
    assert.match(
      quotePrefillSource,
      new RegExp("\\b" + layoutType + "\\s*:\\s*[\\\"']" + presetId + "[\\\"']"),
      layoutType + " must map to its quote-form layout",
    );
  }

  assert.match(quotePrefillSource, /const layout = resolveStoredLayout\(config\)/);
  assert.match(siteSource, /createQuotePrefill\(config\)/);
  assert.match(siteSource, /Object\.entries\(quotePrefill\.fields\)/);
  assert.match(siteSource, /formatStoredPrice\(quotePrefill\.price\)/);
  assert.match(siteSource, /quotePrefill\.frontProfiles\?\.door\?\.label/);
  assert.match(siteSource, /quotePrefill\.frontProfiles\?\.door\?\.styles/);
  assert.match(siteSource, /quotePrefill\.frontProfiles\?\.drawer\?\.label/);
  assert.match(siteSource, /quotePrefill\.hardwareSelection\?\.label/);
  assert.match(quotePrefillSource, /layoutLabel: layout\.label/);
  assert.match(quotePrefillSource, /compatibleLightingComponents > 0/);
  assert.doesNotMatch(siteSource, /setFormValue\(form, "layout", config\.layoutPreset/);
});

test("quote preview validates saved designs and never retains personal information", () => {
  const quotePage = pageSource.get("request-quote.html");
  assert.match(siteSource, /restoreAcceptedDesignSnapshot\(storedDesign\)/);
  assert.match(siteSource, /\[2, 3, 4, 5\]\.includes\(Number\(storedDesign\.schemaVersion\)\)/);
  assert.match(siteSource, /requestedDesignId === acceptedStoredDesign\.snapshot\.id/);
  assert.match(siteSource, /renderQuoteHardwareSchedule\(quotePrefill\.hardwareSchedule\)/);
  assert.match(siteSource, /No personal information was transmitted/);
  assert.doesNotMatch(siteSource, /jqBookcasesQuoteDraft/);
  assert.match(quotePage, /data-quote-fields[^>]*inert/);
  assert.match(siteSource, /interactiveFields\.inert = false/);
  assert.match(quotePage, /data-quote-submit[^>]*disabled/);
  assert.match(quotePage, /id="quote-project-files"[^>]*disabled/);
  assert.match(siteSource, /photoInput\.disabled = false/);
  assert.match(quotePage, /does not currently transmit a quote request/);
  for (const field of [
    "doorFrontProfile",
    "drawerFrontProfile",
    "hardwareType",
    "hardwareFinish",
    "hardwareVariant",
    "hardwareSchedule",
    "hardwareCatalogVersion",
    "hardwareSourceLinks",
  ]) {
    assert.match(quotePage, new RegExp(`<input\\s+name=["']${field}["']\\s+type=["']hidden["']`));
  }
});

test("local development servers bind to loopback instead of exposing repository files", () => {
  assert.match(packageSource, /http\.server 5173 --bind 127\.0\.0\.1/);
  assert.match(playwrightConfigSource, /http\.server \$\{testPort\} --bind 127\.0\.0\.1/);
});

test("browser modules use one cache identity for every shared dependency", () => {
  const identitiesByPath = new Map();
  const runtimeModules = readdirSync(rootDir).filter((file) => file.endsWith(".js"));
  for (const file of runtimeModules) {
    const source = readFileSync(path.join(rootDir, file), "utf8");
    const imports = source.matchAll(/(?:from\s*|import\s*\()\s*["'](\.\/[^"']+\.js(?:\?[^"']*)?)["']/g);
    for (const match of imports) {
      const url = new URL(match[1], `https://jq-bookcases.test/${file}`);
      if (!identitiesByPath.has(url.pathname)) identitiesByPath.set(url.pathname, new Set());
      identitiesByPath.get(url.pathname).add(url.search);
    }
  }

  for (const [modulePath, identities] of identitiesByPath) {
    assert.equal(identities.size, 1, `${modulePath} loads through multiple browser cache identities: ${[...identities].join(", ")}`);
  }
});

test("manual production release uses an allowlisted Pages artifact", () => {
  assert.match(productionWorkflowSource, /find \. -maxdepth 1 -type f/);
  assert.match(productionWorkflowSource, /-name '\*\.html'/);
  assert.match(productionWorkflowSource, /-name '\*\.css'/);
  assert.match(productionWorkflowSource, /-name '\*\.js'/);
  assert.match(productionWorkflowSource, /! -name 'playwright\.config\.js'/);
  assert.match(productionWorkflowSource, /cp -R assets styles _site\//);
  assert.match(productionWorkflowSource, /cp -R data\/generated _site\/data\//);
  assert.doesNotMatch(productionWorkflowSource, /rsync -a|cp -R \.\/ _site/);
  assert.match(productionWorkflowSource, /test ! -e _site\/playwright\.config\.js/);
  assert.match(productionWorkflowSource, /test ! -e _site\/package\.json/);

  for (const runtimeAsset of [
    "_site/assets/vendor/three.module.js",
    "_site/data/generated/benjamin-moore-colors.json",
  ]) {
    assert.match(
      productionWorkflowSource,
      new RegExp("test -f " + runtimeAsset.replaceAll("/", "\\/")),
      runtimeAsset + " must be verified before upload",
    );
  }
});

test("browser QA screenshots stay in ignored test output", () => {
  assert.doesNotMatch(
    configuratorBrowserTestSource,
    /\bpath:\s*[`"']artifacts\//,
    "browser tests must not overwrite tracked QA evidence",
  );
  assert.match(
    configuratorBrowserTestSource,
    /\bpath:\s*[`"']test-results\//,
    "browser screenshots must use the ignored Playwright output directory",
  );
});
