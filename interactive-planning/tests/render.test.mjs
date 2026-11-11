import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const renderer = fileURLToPath(new URL("../scripts/render.mjs", import.meta.url));
const example = JSON.parse(await readFile(new URL("../examples/engineering.json", import.meta.url), "utf8"));
for (const item of example.sections.flatMap(section => section.items)) {
  if (item.previewFile) item.previewFile.path = fileURLToPath(new URL(`../examples/${item.previewFile.path}`, import.meta.url));
}

test("the render CLI creates a portable page and rejects invalid proposals without replacing the prior page", async () => {
  const directory = await mkdtemp(join(tmpdir(), "interactive-planning-render-"));
  const input = join(directory, "plan.json");
  const output = join(directory, "review.html");
  const run = () => spawnSync(process.execPath, [renderer, input, output], { encoding: "utf8" });
  try {
    await writeFile(input, JSON.stringify(example));
    const success = run();
    assert.equal(success.status, 0, success.stderr);
    const html = await readFile(output, "utf8");
    assert.ok(html.startsWith("<!doctype html>"));
    assert.ok(html.includes(example.title));
    for (const [name, mutate, reason] of [
      ["duplicate item", plan => { plan.sections[0].items[1].id = "incremental-index"; }, /duplicate or reserved ID/],
      ["missing dependency", plan => { plan.sections[1].items[0].dependsOn = ["missing"]; }, /unknown item/],
      ["dependency cycle", plan => { plan.sections[0].items[0].dependsOn = ["prove-recovery"]; }, /dependency cycle/],
      ["active URL", plan => { plan.sections[0].items[0].links = [{ label: "Unsafe", url: "javascript:alert(1)" }]; }, /HTTP/],
      ["invalid revision", plan => { plan.revision = 0; }, /positive integer/],
      ["reserved ID", plan => { plan.sections[0].items[0].id = "copy"; }, /reserved ID/],
      ["overall feedback collision", plan => { plan.sections[0].items[0].id = "overall"; }, /reserved ID/],
      ["control collision", plan => { plan.sections[0].items.push({ id: "comment-incremental-index", kind: "fact", title: "Collision", body: "A distinct item must not reuse a control ID." }); }, /review control/],
      ["label collision", plan => { plan.sections[0].items.push({ id: "incremental-index-label", kind: "fact", title: "Collision", body: "A distinct item must not reuse a heading ID." }); }, /review control/],
      ["invalid preview height", plan => { plan.sections[0].items[0].previewFile.height = -1; }, /preview height/],
      ["invalid preview type", plan => { plan.sections[0].items[0].previewFile.path = "unsafe.js"; }, /local HTML/]
    ]) {
      const plan = structuredClone(example);
      mutate(plan);
      await writeFile(input, JSON.stringify(plan));
      const result = run();
      assert.equal(result.status, 1, name);
      assert.match(result.stderr, reason, name);
      assert.equal(await readFile(output, "utf8"), html, `${name} preserved the earlier page`);
    }
    const sameFile = spawnSync(process.execPath, [renderer, input, input], { encoding: "utf8" });
    assert.equal(sameFile.status, 1);
    assert.match(sameFile.stderr, /Refusing to overwrite/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
