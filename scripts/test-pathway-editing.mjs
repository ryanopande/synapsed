// Dependency-free checks for lib/learning-paths/pathwayEditing.ts. Run: node scripts/test-pathway-editing.mjs
import ts from "typescript";
import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync(new URL("../lib/learning-paths/pathwayEditing.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const m = { exports: {} };
new Function("module", "exports", js)(m, m.exports);
const { applyEdit, orderNodes, validateNodes, splitBlockTag, LIMITS } = m.exports;

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ok -", name); };
const node = (id, deps = [], extra = {}) => ({ nodeId: id, title: `T-${id}`, description: `[block_01] desc ${id}`, type: "topic", difficulty: "beginner", duration: "30 min", dependsOn: deps, ...extra });
const chain = (...ids) => ids.map((id, i) => node(id, i === 0 ? [] : [ids[i - 1]]));
const ids = (nodes) => nodes.map((n) => n.nodeId).join(",");
const deps = (nodes, id) => nodes.find((n) => n.nodeId === id).dependsOn.slice().sort().join(",");
const ok = (r) => { assert.equal(r.ok, true, r.error); return r.nodes; };
const bad = (r, re) => { assert.equal(r.ok, false); if (re) assert.match(r.error, re); };

console.log("ordering");
t("scrambled storage order becomes learning order", () => {
  const scrambled = [node("c", ["b"]), node("a"), node("b", ["a"])];
  assert.equal(ids(orderNodes(scrambled)), "a,b,c");
});
t("saved positions win when every node has one", () => {
  const withPos = [node("b", ["a"], { position: 1 }), node("a", [], { position: 0 })];
  assert.equal(ids(orderNodes(withPos)), "a,b");
});
t("ties keep incoming order; a stray cycle does not hang", () => {
  assert.equal(ids(orderNodes([node("x"), node("y"), node("z")])), "x,y,z");
  assert.equal(orderNodes([node("p", ["q"]), node("q", ["p"])]).length, 2);
});

console.log("validation");
t("rejects empty, duplicates, dangling, self, loops", () => {
  assert.match(validateNodes([]), /at least one/);
  assert.match(validateNodes([node("a"), node("a")]), /share the id/);
  assert.match(validateNodes([node("a", ["zzz"])]), /does not exist/);
  assert.match(validateNodes([node("a", ["a"])]), /itself/);
  assert.match(validateNodes([node("a", ["b"]), node("b", ["a"])]), /loop/);
  assert.equal(validateNodes(chain("a", "b", "c")), null);
});

console.log("add");
t("add in the middle re-links the chain", () => {
  const r = ok(applyEdit(chain("a", "b", "c"), { action: "add", node: { title: "New" }, afterNodeId: "a" }));
  assert.equal(ids(r), "a,instructor_1,b,c");
  assert.equal(deps(r, "instructor_1"), "a"); assert.equal(deps(r, "b"), "instructor_1"); assert.equal(deps(r, "c"), "b");
  assert.equal(r[1].addedByInstructor, true); assert.equal(r[1].rationale, null);
});
t("add at the start and at the end", () => {
  const s = ok(applyEdit(chain("a", "b"), { action: "add", node: { title: "First" }, afterNodeId: null }));
  assert.equal(ids(s), "instructor_1,a,b"); assert.equal(deps(s, "a"), "instructor_1"); assert.equal(deps(s, "instructor_1"), "");
  const e = ok(applyEdit(chain("a", "b"), { action: "add", node: { title: "Last" }, afterNodeId: "b" }));
  assert.equal(ids(e), "a,b,instructor_1"); assert.equal(deps(e, "instructor_1"), "b");
});
t("add uses defaults and strips a typed block tag; new ids never clash", () => {
  const r = ok(applyEdit([node("instructor_1"), node("b", ["instructor_1"])], { action: "add", node: { title: "  Spaced   title ", description: "[block_05a] hello" }, afterNodeId: "b" }));
  const added = r.find((n) => n.title === "Spaced title");
  assert.equal(added.nodeId, "instructor_2"); assert.equal(added.description, "hello");
  assert.equal(added.difficulty, "beginner"); assert.equal(added.type, "topic"); assert.equal(added.duration, "30 min");
});
t("add errors", () => {
  bad(applyEdit(chain("a"), { action: "add", node: { title: "  " }, afterNodeId: "a" }), /title/);
  bad(applyEdit(chain("a"), { action: "add", node: { title: "x" }, afterNodeId: "nope" }), /no longer exists/);
  bad(applyEdit(chain("a"), { action: "add", node: { title: "x", difficulty: "insane" }, afterNodeId: "a" }), /Difficulty/);
  bad(applyEdit(chain("a"), { action: "add", node: { title: "x", type: "video" }, afterNodeId: "a" }), /Type/);
  const full = Array.from({ length: LIMITS.maxNodes }, (_, i) => node(`n${i}`, i ? [`n${i - 1}`] : []));
  bad(applyEdit(full, { action: "add", node: { title: "x" }, afterNodeId: null }), /at most/);
});

console.log("remove");
t("remove middle / first / last keeps a valid chain", () => {
  const mid = ok(applyEdit(chain("a", "b", "c"), { action: "remove", nodeId: "b" }));
  assert.equal(ids(mid), "a,c"); assert.equal(deps(mid, "c"), "a");
  const first = ok(applyEdit(chain("a", "b", "c"), { action: "remove", nodeId: "a" }));
  assert.equal(ids(first), "b,c"); assert.equal(deps(first, "b"), "");
  const last = ok(applyEdit(chain("a", "b", "c"), { action: "remove", nodeId: "c" }));
  assert.equal(ids(last), "a,b");
});
t("remove in a branching pathway bridges to the inherited prerequisites", () => {
  const g = [node("a"), node("b", ["a"]), node("c", ["a"]), node("d", ["b", "c"])];
  const r = ok(applyEdit(g, { action: "remove", nodeId: "b" }));
  assert.equal(deps(r, "d"), "a,c"); assert.equal(validateNodes(r), null);
});
t("cannot remove the last node or an unknown node", () => {
  bad(applyEdit(chain("a"), { action: "remove", nodeId: "a" }), /at least one/);
  bad(applyEdit(chain("a", "b"), { action: "remove", nodeId: "zzz" }), /no longer exists/);
});

console.log("move");
t("move to the front, to the end, and one step down", () => {
  assert.equal(ids(ok(applyEdit(chain("a", "b", "c", "d"), { action: "move", nodeId: "d", toIndex: 0 }))), "d,a,b,c");
  const front = ok(applyEdit(chain("a", "b", "c", "d"), { action: "move", nodeId: "d", toIndex: 0 }));
  assert.equal(deps(front, "d"), ""); assert.equal(deps(front, "a"), "d"); assert.equal(deps(front, "c"), "b");
  const mid = ok(applyEdit(chain("a", "b", "c", "d"), { action: "move", nodeId: "a", toIndex: 2 }));
  assert.equal(ids(mid), "b,c,a,d"); assert.equal(deps(mid, "b"), ""); assert.equal(deps(mid, "c"), "b"); assert.equal(deps(mid, "a"), "c"); assert.equal(deps(mid, "d"), "a");
  const down = ok(applyEdit(chain("a", "b", "c", "d"), { action: "move", nodeId: "b", toIndex: 2 }));
  assert.equal(ids(down), "a,c,b,d"); assert.equal(deps(down, "c"), "a"); assert.equal(deps(down, "b"), "c"); assert.equal(deps(down, "d"), "b");
});
t("move errors", () => {
  bad(applyEdit(chain("a", "b"), { action: "move", nodeId: "a", toIndex: 0 }), /already/);
  bad(applyEdit(chain("a", "b"), { action: "move", nodeId: "a", toIndex: 5 }), /position/);
  bad(applyEdit(chain("a", "b"), { action: "move", nodeId: "a", toIndex: 1.5 }), /position/);
  bad(applyEdit(chain("a", "b"), { action: "move", nodeId: "q", toIndex: 0 }), /no longer exists/);
});

console.log("update");
t("update flags the node, keeps prerequisites and the block tag", () => {
  const r = ok(applyEdit(chain("a", "b"), { action: "update", nodeId: "b", fields: { title: " New   title ", description: "[block_09] rewritten", difficulty: "advanced", duration: "2 hours" } }));
  const b = r.find((n) => n.nodeId === "b");
  assert.equal(b.title, "New title"); assert.equal(b.difficulty, "advanced"); assert.equal(b.duration, "2 hours");
  assert.equal(b.description, "[block_01] rewritten"); assert.equal(splitBlockTag(b.description).tag, "block_01");
  assert.equal(b.editedByInstructor, true); assert.equal(deps(r, "b"), "a");
});
t("update errors: empty, unchanged, invalid values, too long", () => {
  bad(applyEdit(chain("a"), { action: "update", nodeId: "a", fields: { title: " " } }), /empty/);
  bad(applyEdit(chain("a"), { action: "update", nodeId: "a", fields: { title: "T-a" } }), /Nothing was changed/);
  bad(applyEdit(chain("a"), { action: "update", nodeId: "a", fields: { difficulty: "hard" } }), /Difficulty/);
  bad(applyEdit(chain("a"), { action: "update", nodeId: "a", fields: { title: "x".repeat(LIMITS.title + 1) } }), /at most/);
  bad(applyEdit(chain("a"), { action: "update", nodeId: "nope", fields: { title: "x" } }), /no longer exists/);
});
t("a description with no tag stays untagged", () => {
  const r = ok(applyEdit([node("a", [], { description: "plain" })], { action: "update", nodeId: "a", fields: { description: "still plain" } }));
  assert.equal(r[0].description, "still plain");
});

console.log("safety");
t("the input is never mutated", () => {
  const input = chain("a", "b", "c"); const snap = JSON.stringify(input);
  applyEdit(input, { action: "remove", nodeId: "b" }); applyEdit(input, { action: "move", nodeId: "a", toIndex: 2 });
  applyEdit(input, { action: "add", node: { title: "x" }, afterNodeId: "a" }); applyEdit(input, { action: "update", nodeId: "a", fields: { title: "q" } });
  assert.equal(JSON.stringify(input), snap);
});
t("fuzz: 2000 random edits on chains and branching graphs never produce an invalid pathway", () => {
  let seed = 12345; const rnd = (n) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
  for (let run = 0; run < 40; run++) {
    let nodes = chain("n0", "n1", "n2", "n3", "n4", "n5");
    if (run % 2) nodes = [node("n0"), node("n1", ["n0"]), node("n2", ["n0"]), node("n3", ["n1", "n2"]), node("n4", ["n3"]), node("n5", ["n3"])];
    for (let step = 0; step < 50; step++) {
      const ordered = orderNodes(nodes); const pick = ordered[rnd(ordered.length)].nodeId; const kind = rnd(4);
      const edit = kind === 0 ? { action: "add", node: { title: `X${run}-${step}` }, afterNodeId: rnd(3) === 0 ? null : ordered[rnd(ordered.length)].nodeId }
        : kind === 1 ? { action: "remove", nodeId: pick }
        : kind === 2 ? { action: "move", nodeId: pick, toIndex: rnd(ordered.length) }
        : { action: "update", nodeId: pick, fields: { title: `U${step}`, difficulty: ["beginner", "intermediate", "advanced"][rnd(3)] } };
      const r = applyEdit(nodes, edit);
      if (!r.ok) continue;                        // refused edits are fine (e.g. "already there")
      assert.equal(validateNodes(r.nodes), null);   // never invalid
      const pos = new Map(r.nodes.map((n, i) => [n.nodeId, i]));
      for (const n of r.nodes) for (const d of n.dependsOn) assert.ok(pos.get(d) < pos.get(n.nodeId), `prerequisite ${d} must come before ${n.nodeId}`);
      nodes = r.nodes;
    }
  }
});

console.log(`\nALL ${passed} CHECKS PASSED`);
