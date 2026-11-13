import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { once } from "node:events";

// Run from a directory whose node_modules has Playwright. Pass a task-owned proof directory.
// This test drives the generated page. Run it only after a change to the template or the renderer.
const require = createRequire(resolve(process.cwd(), "package.json"));
const { chromium } = require("playwright");
assert.ok(process.argv[2], "Pass a task-owned proof directory.");
const directory = resolve(process.argv[2]);
await mkdir(join(directory, "previews"), { recursive: true });
// The renderer refuses to lower a revision, so a rerun starts without the pages from the last run.
for (const name of ["engineering", "design"]) await rm(join(directory, `${name}.html`), { force: true });
const examples = fileURLToPath(new URL("../examples/", import.meta.url));
for (const name of ["picker-ready", "picker-empty", "picker-loading", "picker-error", "search-flow"]) {
  await copyFile(join(examples, `previews/${name}.html`), join(directory, `previews/${name}.html`));
}
const renderer = fileURLToPath(new URL("../scripts/render.mjs", import.meta.url));
const engineering = JSON.parse(await readFile(join(examples, "engineering.json"), "utf8"));
const design = JSON.parse(await readFile(join(examples, "design.json"), "utf8"));
const pages = new Map();
async function render(name, plan) {
  const input = join(directory, `${name}.json`);
  const output = join(directory, `${name}.html`);
  await writeFile(input, JSON.stringify(plan));
  const result = spawnSync(process.execPath, [renderer, input, output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  pages.set(`/${name}.html`, await readFile(output));
}
await render("engineering", engineering);
await render("design", design);

const server = createServer((request, response) => {
  const page = pages.get(request.url.split("?")[0]);
  response.writeHead(page ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
  response.end(page ?? "Not found");
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
function watch(page) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", entry => { if (entry.type() === "error") errors.push(entry.text()); });
  return page;
}
const feedback = page => page.locator("#ip-feedback").inputValue();
const block = (plan, id) => plan.sections.flatMap(section => section.blocks).find(entry => entry.id === id);

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = watch(await context.newPage());
  await page.goto(`${origin}/engineering.html`);
  assert.equal(await feedback(page), `Feedback on "${engineering.title}" (example-search-index, revision 1)\nNo input yet.`);
  assert.equal(await page.locator("#ip-input-list li").count(), 3, "one decision, one question, and approval with its okay toggle");

  await page.locator("#ip-r-update-method-0").check();
  await page.locator("#ip-r-max-delay-0").fill("5 seconds");
  await page.locator("#ip-ok-ok-staging-rebuild").check();
  await page.locator("#ip-c-why-slow").click();
  await page.locator("#ip-t-why-slow").fill("Show the wait time for two saves.");
  await page.locator("#ip-k-why-slow").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Add comment" }).click();
  await page.locator("#ip-a-approve").click();
  await page.locator("#ip-overall").fill("Looks right.");

  await page.locator(".ip-term").first().click();
  assert.equal(await page.locator(".ip-tip:not([hidden])").count(), 1, "a term shows its definition on tap");

  await page.reload();
  const text = await feedback(page);
  for (const line of ["Approval: Approve", "Okay ok-staging-rebuild: yes", "Decision update-method: incremental (Incremental updates)", "Answer max-delay: 5 seconds", "Overall: Looks right."]) {
    assert.ok(text.includes(line), `export after reload has: ${line}\n${text}`);
  }
  assert.match(text, /Comment why-slow\.1 \([a-z ]+\): Show the wait time for two saves\./);
  assert.ok(Buffer.byteLength(text) < 1000, "the export stays short");
  assert.equal(await page.locator("#ip-a-approve").getAttribute("aria-checked"), "true");

  const second = structuredClone(engineering);
  second.revision = 2;
  block(second, "why-slow").body += " With 180,000 documents, two saves wait about 80 seconds.";
  block(second, "update-method").answer = { option: "incremental" };
  block(second, "max-delay").answer = "5 seconds";
  second.approval.okay[0].granted = true;
  block(second, "build-steps").items[0].status = "done";
  second.replies = [{ to: "why-slow.1", comment: "Show the wait time for two saves.", status: "changed", text: "Added the wait time for two saves." }];
  await render("engineering", second);
  await page.reload();
  const revised = await feedback(page);
  assert.ok(!revised.includes("Comment why-slow.1"), `a resolved thread leaves the export\n${revised}`);
  assert.ok(!revised.includes("Decision update-method"), "a recorded answer leaves the export");
  assert.ok(!revised.includes("Okay ok-staging-rebuild"), "a recorded okay leaves the export");
  assert.equal(await page.locator("#why-slow details.ip-thread").count(), 1, "the reply shows as a resolved thread");
  assert.ok(await page.locator(".ip-collapsed").count() >= 3, "unchanged parts collapse");
  assert.equal(await page.locator("#current-facts").count(), 0, "an unchanged block is collapsed");
  await page.locator("#ip-full").click();
  assert.equal(await page.locator("#current-facts").count(), 1, "the full plan shows every block");
  await page.locator("#why-slow details.ip-thread summary").click();
  await page.locator("#why-slow").getByRole("button", { name: "Reopen" }).click();
  assert.match(await feedback(page), /Comment why-slow\.1 \([a-z ]+, reopened\)/);

  for (const name of ["engineering", "design"]) {
    const phone = watch(await browser.newPage({ viewport: { width: 390, height: 844 } }));
    await phone.goto(`${origin}/${name}.html`);
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${name} has no horizontal overflow at 390 px (${overflow} px)`);
    await phone.close();
  }

  const designPage = watch(await context.newPage());
  await designPage.goto(`${origin}/design.html`);
  assert.equal(await designPage.locator("iframe.ip-preview").count(), 4);
  assert.equal(await designPage.locator('a[href="#picker-ready"]').count(), 1, "an option links to its example");

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
  const blockedPage = await blocked.newPage();
  blockedPage.on("pageerror", error => errors.push(error.message));
  await blockedPage.goto(`${origin}/design.html`);
  await blockedPage.locator("#ip-overall").fill("Kept in memory.");
  assert.ok(await blockedPage.locator("#ip-storage").isVisible(), "blocked storage shows a warning");
  assert.match(await feedback(blockedPage), /Overall: Kept in memory\./);
  await blocked.close();

  assert.deepEqual(errors, []);
  console.log("Browser checks passed.");
} finally {
  await browser.close();
  server.close();
}
