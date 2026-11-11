import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { once } from "node:events";

// Exercise the generated page, not copied rendering or persistence logic.
const require = createRequire(resolve(process.cwd(), "package.json"));
const { chromium } = require("playwright");
const directory = resolve(process.argv[2] ?? "");
assert.ok(process.argv[2], "Pass a task-owned proof directory.");
await mkdir(directory, { recursive: true });
const renderer = fileURLToPath(new URL("../scripts/render.mjs", import.meta.url));
const engineering = JSON.parse(await readFile(new URL("../examples/engineering.json", import.meta.url), "utf8"));
const design = JSON.parse(await readFile(new URL("../examples/design.json", import.meta.url), "utf8"));
for (const plan of [engineering, design]) {
  for (const item of plan.sections.flatMap(section => section.items)) {
    if (item.previewFile) item.previewFile.path = fileURLToPath(new URL(`../examples/${item.previewFile.path}`, import.meta.url));
  }
}
const generated = new Map();
async function generate(name, plan) {
  const input = join(directory, `${name}.json`);
  const output = join(directory, `${name}.html`);
  await writeFile(input, JSON.stringify(plan));
  const result = spawnSync(process.execPath, [renderer, input, output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  generated.set(`/${name}.html`, await readFile(output));
  return output;
}
await generate("engineering", engineering);
await generate("design", design);
const server = createServer((request, response) => {
  const page = generated.get(request.url.split("?")[0]);
  response.writeHead(page ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
  response.end(page ?? "Not found");
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const failures = [];
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", error => failures.push(error.message));
  if (process.argv[3]) {
    const migrationContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const migration = await migrationContext.newPage();
    migration.on("pageerror", error => failures.push(error.message));
    generated.set("/migration.html", await readFile(resolve(process.argv[3])));
    await migration.goto(`${origin}/migration.html`);
    await migration.screenshot({ path: join(directory, "template-before.png") });
    await migration.locator("#comment-picker-ready").fill("Preserve feedback from the earlier template.");
    await migration.locator("#decision-picker-ready").selectOption("accept");
    const stored = await migration.evaluate(() => localStorage.getItem("interactive-planning:v1:example-project-picker"));
    generated.set("/migration.html", generated.get("/design.html"));
    await migration.reload();
    assert.equal(await migration.locator("#comment-picker-ready").inputValue(), "Preserve feedback from the earlier template.");
    assert.equal(await migration.locator("#decision-picker-ready").inputValue(), "accept");
    assert.equal(await migration.evaluate(() => localStorage.getItem("interactive-planning:v1:example-project-picker")), stored, "A template cutover must not rewrite earlier feedback or review snapshots.");
    await migrationContext.close();
  }
  await page.goto(`${origin}/engineering.html`);
  await page.getByRole("heading", { name: engineering.title, exact: true }).waitFor();
  await page.frameLocator("#incremental-index iframe").getByText("Existing index writer", { exact: true }).waitFor();
  for (const width of [1440, 1100, 1099, 768, 767, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    const frame = page.frames().find(frame => frame.parentFrame());
    assert.equal(await frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), true, `The engineering diagram fits at width ${width}.`);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: join(directory, "engineering-before.png") });
  await page.locator("#comment-incremental-index").fill("Keep the existing owner. Prove deletion recovery.");
  await page.locator("#decision-incremental-index").selectOption("accept");
  await page.locator("#comment-measure-current-cost").fill("Measure this before building.");
  await page.reload();
  assert.equal(await page.locator("#comment-incremental-index").inputValue(), "Keep the existing owner. Prove deletion recovery.");
  assert.equal(await page.locator("#decision-incremental-index").inputValue(), "accept");
  assert.match(await page.locator("#review-count").innerText(), /2 of 4 commented.*1 reviewed/);
  await page.locator("#overall").fill("Keep this plan within the stated scope.");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.reload();
  assert.equal(await page.locator("#overall").inputValue(), "Keep this plan within the stated scope.");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  assert.equal(await page.getByRole("button", { name: "Light", exact: true }).getAttribute("aria-pressed"), "true");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download feedback", exact: true }).click();
  const backupPath = join(directory, "feedback-backup.json");
  await (await downloadPromise).saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, "utf8"));
  assert.equal(backup.planId, "example-search-index");
  assert.equal(backup.revision, 1);
  assert.equal(backup.overall, "Keep this plan within the stated scope.");
  assert.equal(backup.theme, "light");
  assert.equal(backup.entries.find(entry => entry.id === "incremental-index").decision, "accept");
  assert.equal(backup.entries.find(entry => entry.id === "incremental-index").state, "current");
  const planDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download plan", exact: true }).click();
  const planPath = join(directory, "exported-plan.md");
  await (await planDownload).saveAs(planPath);
  assert.match(await readFile(planPath, "utf8"), /Recovery/);

  const revised = structuredClone(engineering);
  revised.revision = 2;
  revised.changes = "Clarify the update path. Remove the earlier measurement item after collecting evidence.";
  revised.sections[0].items[0].body = "Keep one index writer. Preserve ordering during a restart.";
  revised.sections[0].items.pop();
  revised.sections[1].items[0].dependsOn = ["incremental-index"];
  await generate("engineering", revised);
  await page.reload();
  assert.match(await page.locator("#incremental-index .notice").innerText(), /Review again/);
  assert.match(await page.locator("#review-count").innerText(), /1 of 3 commented.*1 need another review/);
  assert.doesNotMatch(await page.locator("#review-count").innerText(), /1 reviewed/);
  await page.locator("#comment-incremental-index").fill("Preserve this earlier decision until I review the change.");
  await page.reload();
  assert.match(await page.locator("#incremental-index .notice").innerText(), /Review again/);
  assert.match(await page.locator("#history-items").innerText(), /Measure this before building/);
  await page.screenshot({ path: join(directory, "engineering-after.png") });

  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("Denied"); } }, configurable: true }));
  await page.locator("#copy").click();
  await page.locator("#feedback-text").waitFor({ state: "visible" });
  const readable = await page.locator("#feedback-text").inputValue();
  assert.match(readable, /State: changed/);
  assert.match(readable, /measure-current-cost/);
  assert.match(readable, /Keep this plan within the stated scope/);
  assert.match(await page.locator("#action-status").innerText(), /Clipboard access failed/);
  await page.getByRole("button", { name: "Keep decision for this revision" }).click();
  assert.equal(await page.locator("#incremental-index .notice").count(), 0);
  assert.match(await page.locator("#review-count").innerText(), /1 of 3 commented.*1 reviewed/);

  let copied = "";
  await page.exposeFunction("recordClipboard", text => { copied = text; });
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: text => window.recordClipboard(text) }, configurable: true }));
  await page.locator("#copy-2").click();
  await page.getByText("Feedback copied. Paste it into the conversation.", { exact: true }).waitFor();
  assert.match(copied, /Reviewed revision: 2/);

  const changedScope = structuredClone(revised);
  changedScope.revision = 3;
  changedScope.scope = "The proposal now includes a ranking change that needs another review.";
  await generate("engineering", changedScope);
  await page.reload();
  assert.match(await page.locator("#incremental-index .notice").innerText(), /Review again/);
  assert.doesNotMatch(await page.locator("#review-count").innerText(), /1 reviewed/);
  await generate("engineering", revised);

  const restorePage = await context.newPage();
  await restorePage.goto(`${origin}/design.html`);
  await restorePage.locator("#transfer").evaluate(node => { node.open = true; });
  await restorePage.locator("#restore").setInputFiles(backupPath);
  await restorePage.getByText("Cannot restore feedback: Choose a version 1 backup for this plan.", { exact: true }).waitFor();
  const fresh = await browser.newContext();
  const restored = await fresh.newPage();
  await restored.goto(`${origin}/engineering.html`);
  await restored.locator("#transfer").evaluate(node => { node.open = true; });
  await restored.locator("#restore").setInputFiles(backupPath);
  await restored.getByText("Feedback restored. Changed proposals still need another review.", { exact: true }).waitFor();
  assert.equal(await restored.locator("#comment-incremental-index").inputValue(), "Keep the existing owner. Prove deletion recovery.");
  assert.equal(await restored.locator("#overall").inputValue(), "Keep this plan within the stated scope.");
  assert.equal(await restored.locator("html").getAttribute("data-theme"), "light");
  assert.match(await restored.locator("#incremental-index .notice").innerText(), /Review again/);
  restored.once("dialog", dialog => dialog.dismiss());
  await restored.locator("#restore").setInputFiles(backupPath);
  assert.equal(await restored.locator("#comment-incremental-index").inputValue(), "Keep the existing owner. Prove deletion recovery.");
  await fresh.close();

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage is blocked.", "SecurityError"); };
  });
  const blocked = await blockedContext.newPage();
  await blocked.goto(`${origin}/engineering.html`);
  await blocked.locator("#comment-incremental-index").fill("Still available for export.");
  assert.match(await blocked.locator("#storage-warning").innerText(), /memory only/);
  const blockedDownload = blocked.waitForEvent("download");
  await blocked.getByRole("button", { name: "Download feedback", exact: true }).click();
  const blockedPath = join(directory, "memory-only-backup.json");
  await (await blockedDownload).saveAs(blockedPath);
  assert.equal(JSON.parse(await readFile(blockedPath, "utf8")).entries[0].comment, "Still available for export.");
  await blockedContext.close();

  const corruptContext = await browser.newContext();
  await corruptContext.addInitScript(() => localStorage.setItem("interactive-planning:v1:example-search-index", "{broken"));
  const corrupt = await corruptContext.newPage();
  await corrupt.goto(`${origin}/engineering.html`);
  assert.match(await corrupt.locator("#storage-warning").innerText(), /Cannot read saved feedback/);
  assert.equal(await corrupt.locator("#comment-incremental-index").inputValue(), "");
  await corruptContext.close();

  const fileContext = await browser.newContext();
  const localFile = await fileContext.newPage();
  await localFile.goto(pathToFileURL(join(directory, "design.html")).href);
  await localFile.locator("#comment-picker-ready").fill("Feedback from the standalone HTML file.");
  await localFile.reload();
  assert.equal(await localFile.locator("#comment-picker-ready").inputValue(), "Feedback from the standalone HTML file.");
  await fileContext.close();

  const simultaneous = await browser.newContext();
  const firstTab = await simultaneous.newPage();
  const secondTab = await simultaneous.newPage();
  await firstTab.goto(`${origin}/engineering.html`);
  await secondTab.goto(`${origin}/engineering.html`);
  await firstTab.locator("#comment-incremental-index").fill("Keep this first-tab copy.");
  await secondTab.locator("#storage-warning").filter({ hasText: "Another tab changed" }).waitFor();
  await secondTab.locator("#comment-incremental-index").fill("Second-tab feedback stays in memory.");
  const storedComment = await firstTab.evaluate(() => JSON.parse(localStorage.getItem("interactive-planning:v1:example-search-index")).entries[0].comment);
  assert.equal(storedComment, "Keep this first-tab copy.");
  await simultaneous.close();

  const illustrated = structuredClone(design);
  illustrated.planId = "example-embedded-image";
  await writeFile(join(directory, "pixel.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8mQAAAAASUVORK5CYII=", "base64"));
  await page.screenshot({ path: join(directory, "mobile-pixel.png"), clip: { x: 0, y: 0, width: 2, height: 1 } });
  illustrated.sections[0].items[0].image = { path: "pixel.png", mobilePath: "mobile-pixel.png", alt: "Synthetic test pixel", caption: "Synthetic image for renderer proof." };
  await generate("illustrated", illustrated);
  await page.goto(`${origin}/illustrated.html`);
  const image = page.getByRole("img", { name: "Synthetic test pixel" });
  assert.equal(await image.evaluate(node => node.complete && node.naturalWidth === 1), true);
  assert.match(await image.getAttribute("src"), /^data:image\/png;base64,/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  assert.equal(await image.evaluate(node => node.naturalWidth), 2, "A narrow image must replace the desktop capture rather than shrink its text.");
  await page.setViewportSize({ width: 1440, height: 1100 });

  const adversarial = structuredClone(design);
  adversarial.planId = "example-untrusted-text";
  adversarial.title = "</script><img src=x onerror=alert(1)>";
  adversarial.sections[0].items[0].body = "<script>window.injected=true</script>";
  await generate("untrusted", adversarial);
  await page.goto(`${origin}/untrusted.html`);
  assert.equal(await page.locator("h1").innerText(), adversarial.title);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  assert.equal(await page.locator("img").count(), 0);

  const isolated = structuredClone(design);
  isolated.planId = "example-isolated-preview";
  await writeFile(join(directory, "untrusted-preview.html"), '<style>body{color:white}</style><h1>Isolated example</h1><script>parent.document.body.dataset.previewEscaped="yes";</script><img src="https://invalid.example/should-not-load.png">');
  isolated.sections[0].items[0].previewFile = { path: "untrusted-preview.html", label: "Static sandbox test", height: 240 };
  await generate("isolated", isolated);
  const networkAttempts = [];
  const blockedRequests = [];
  await page.route("https://invalid.example/**", async route => {
    networkAttempts.push(route.request().url());
    await route.abort();
  });
  page.on("requestfailed", request => {
    if (request.url().startsWith("https://invalid.example/")) blockedRequests.push(request.failure()?.errorText);
  });
  await page.goto(`${origin}/isolated.html`);
  await page.frameLocator("#picker-ready iframe").getByRole("heading", { name: "Isolated example" }).waitFor();
  assert.equal(await page.locator("#picker-ready iframe").getAttribute("sandbox"), "");
  assert.equal(await page.evaluate(() => document.body.dataset.previewEscaped), undefined);
  assert.deepEqual(networkAttempts, []);
  assert.deepEqual(blockedRequests, ["csp"]);

  await page.goto(`${origin}/design.html`);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const narrowStage = await page.locator("#picker-ready .ex-stage").boundingBox();
  const narrowFeedback = await page.locator("#picker-ready .ex-side").boundingBox();
  assert.ok(narrowFeedback.y >= narrowStage.y + narrowStage.height - 1, "The original gallery stacks feedback below examples on narrow screens.");
  for (const frame of page.frames().slice(1)) {
    assert.equal(await frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), true, `The narrow preview fits: ${await frame.title()}`);
  }
  await page.locator("#picker-ready").getByText("Interaction", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByText("Keep focus in the search field while filtering.", { exact: false }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(directory, "design-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1100 });
  const wideStage = await page.locator("#picker-ready .ex-stage").boundingBox();
  const wideFeedback = await page.locator("#picker-ready .ex-side").boundingBox();
  assert.equal(wideFeedback.width, 320, "The original gallery keeps its 320-pixel feedback panel on wide screens.");
  assert.ok(wideFeedback.x >= wideStage.x + wideStage.width - 1, "Wide examples retain side feedback rather than a permanently stacked approximation.");
  assert.equal(await page.locator("main").evaluate(node => getComputedStyle(node).maxWidth), "1200px");
  await page.frameLocator("#picker-ready iframe").getByText("Website is selected", { exact: true }).waitFor();
  for (const frame of page.frames().slice(1)) {
    assert.equal(await frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), true, `The desktop preview fits: ${await frame.title()}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(directory, "design-desktop.png") });
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement.tagName);
  assert.ok(["A", "BUTTON", "SELECT", "SUMMARY", "TEXTAREA"].includes(focusedTag));
  assert.deepEqual(failures, []);
  await context.close();
  console.log(`Browser review flow passed. Proof: ${directory}`);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
