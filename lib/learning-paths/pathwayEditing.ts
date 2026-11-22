// Pure rules (no imports) for instructor edits to a learning pathway.
//
// A pathway is a list of nodes in learning order, and each node lists the nodes it depends on
// (`dependsOn`, by nodeId). Students unlock nodes through those prerequisite links, so every
// edit here keeps BOTH the order and the prerequisite links consistent:
//
//  - add a node after X      -> the new node depends on X; nodes that followed X now follow the new node
//  - remove a node           -> its dependants inherit its prerequisites ("bridging"), so nothing is orphaned
//  - move a node             -> remove with bridging, then insert after its new predecessor
//  - edit text/difficulty... -> prerequisites untouched
//
// Nodes are always handed in and out in learning order. Nothing here touches a database.

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export const NODE_TYPES = ["topic", "subtopic", "resource", "assessment"] as const;
export const LIMITS = { maxNodes: 30, title: 120, description: 800, duration: 40 } as const;

export type EditableNode = {
  /** database id; absent for a node that has not been saved yet */
  id?: string;
  nodeId: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  duration: string;
  dependsOn: string[];
  rationale?: string | null;
  evidence?: unknown;
  addedByInstructor?: boolean | null;
  editedByInstructor?: boolean | null;
};

export type EditableFields = Partial<
  Pick<EditableNode, "title" | "description" | "type" | "difficulty" | "duration">
>;

export type EditAction =
  | { action: "update"; nodeId: string; fields: EditableFields }
  | {
      action: "add";
      node: { title: string; description?: string; type?: string; difficulty?: string; duration?: string };
      /** insert after this node; null = at the start */
      afterNodeId: string | null;
    }
  | { action: "remove"; nodeId: string }
  /** toIndex is the node's new 0-based position in the learning order */
  | { action: "move"; nodeId: string; toIndex: number };

export type EditResult =
  | { ok: true; nodes: EditableNode[]; summary: string; nodeId?: string }
  | { ok: false; error: string };

const BLOCK_TAG = /^\[(block_[0-9a-z]+)\]\s*/;

/** Pathways built by the study generator start each description with a "[block_01]" tag. */
export function splitBlockTag(description: string): { tag: string; text: string } {
  const m = description.match(BLOCK_TAG);
  return m ? { tag: m[1], text: description.slice(m[0].length) } : { tag: "", text: description };
}

function unique(list: string[]): string[] {
  return Array.from(new Set(list));
}

function cloneNode<T extends EditableNode>(n: T): T {
  return { ...n, dependsOn: [...n.dependsOn] };
}

/**
 * Learning order. If every node has a saved `position`, use it. Otherwise use a stable
 * topological order (a node always comes after what it depends on; ties keep the incoming order).
 */
export function orderNodes<T extends { nodeId: string; dependsOn: string[]; position?: number | null }>(
  nodes: T[]
): T[] {
  if (nodes.length > 0 && nodes.every((n) => typeof n.position === "number")) {
    return nodes
      .map((n, i) => ({ n, i }))
      .sort((a, b) => (a.n.position as number) - (b.n.position as number) || a.i - b.i)
      .map((x) => x.n);
  }
  const ids = new Set(nodes.map((n) => n.nodeId));
  const placed = new Set<string>();
  const out: T[] = [];
  const remaining = nodes.slice();
  while (remaining.length > 0) {
    let pick = remaining.findIndex((n) => n.dependsOn.every((d) => !ids.has(d) || placed.has(d)));
    if (pick === -1) pick = 0; // a cycle (should not exist): keep going in the incoming order
    const [next] = remaining.splice(pick, 1);
    placed.add(next.nodeId);
    out.push(next);
  }
  return out;
}

/** Returns a plain-language problem with the node list, or null if it is a valid pathway. */
export function validateNodes(nodes: EditableNode[]): string | null {
  if (nodes.length < 1) return "A pathway needs at least one node.";
  if (nodes.length > LIMITS.maxNodes) return `A pathway can have at most ${LIMITS.maxNodes} nodes.`;
  const ids = new Set<string>();
  for (const n of nodes) {
    if (!n.nodeId) return "Every node needs an id.";
    if (ids.has(n.nodeId)) return `Two nodes share the id "${n.nodeId}".`;
    ids.add(n.nodeId);
  }
  for (const n of nodes) {
    for (const d of n.dependsOn) {
      if (d === n.nodeId) return `"${n.title}" cannot depend on itself.`;
      if (!ids.has(d)) return `"${n.title}" depends on a node that does not exist.`;
    }
  }
  // cycle check (Kahn)
  const done = new Set<string>();
  let progressed = true;
  while (done.size < nodes.length && progressed) {
    progressed = false;
    for (const n of nodes) {
      if (!done.has(n.nodeId) && n.dependsOn.every((d) => done.has(d))) {
        done.add(n.nodeId);
        progressed = true;
      }
    }
  }
  if (done.size < nodes.length) return "These prerequisites would make a loop, so no node could be started first.";
  return null;
}

function insertAfter(list: EditableNode[], node: EditableNode, anchorId: string | null): EditableNode[] {
  const out = list.map(cloneNode);
  if (anchorId === null) {
    // new first node: whatever used to start the pathway now follows it
    for (const root of out.filter((n) => n.dependsOn.length === 0)) root.dependsOn = [node.nodeId];
    node.dependsOn = [];
    out.unshift(node);
    return out;
  }
  const at = out.findIndex((n) => n.nodeId === anchorId);
  for (const n of out) {
    if (n.dependsOn.includes(anchorId)) {
      n.dependsOn = unique(n.dependsOn.map((d) => (d === anchorId ? node.nodeId : d)));
    }
  }
  node.dependsOn = [anchorId];
  out.splice(at + 1, 0, node);
  return out;
}

function removeWithBridge(list: EditableNode[], nodeId: string): EditableNode[] {
  const target = list.find((n) => n.nodeId === nodeId);
  const inherited = target ? target.dependsOn : [];
  return list
    .filter((n) => n.nodeId !== nodeId)
    .map((n) => {
      const c = cloneNode(n);
      if (c.dependsOn.includes(nodeId)) {
        c.dependsOn = unique([...c.dependsOn.filter((d) => d !== nodeId), ...inherited]).filter(
          (d) => d !== c.nodeId
        );
      }
      return c;
    });
}

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function nextNodeId(existing: Set<string>): string {
  let i = 1;
  while (existing.has(`instructor_${i}`)) i++;
  return `instructor_${i}`;
}

function checkEnum(value: unknown, allowed: readonly string[], label: string): string | null {
  return typeof value === "string" && allowed.includes(value)
    ? null
    : `${label} must be one of: ${allowed.join(", ")}.`;
}

/** Apply one instructor edit to a pathway's nodes. Never mutates the input. */
export function applyEdit(input: EditableNode[], edit: EditAction, opts?: { newNodeId?: string }): EditResult {
  const nodes = orderNodes(input).map(cloneNode);
  const byId = (id: string) => nodes.find((n) => n.nodeId === id);
  const finish = (result: EditableNode[], summary: string, nodeId?: string): EditResult => {
    const problem = validateNodes(result);
    return problem ? { ok: false, error: problem } : { ok: true, nodes: result, summary, nodeId };
  };

  switch (edit.action) {
    case "update": {
      const node = byId(edit.nodeId);
      if (!node) return { ok: false, error: "That node no longer exists." };
      const f = edit.fields ?? {};
      const changed: string[] = [];
      const next = cloneNode(node);

      if (f.title !== undefined) {
        const t = oneLine(f.title);
        if (!t) return { ok: false, error: "The title can't be empty." };
        if (t.length > LIMITS.title) return { ok: false, error: `The title can be at most ${LIMITS.title} characters.` };
        if (t !== node.title) { next.title = t; changed.push("title"); }
      }
      if (f.description !== undefined) {
        const { tag, text } = splitBlockTag(node.description);
        const typed = splitBlockTag(oneLine(f.description)).text; // never let a typed tag double up
        if (typed.length > LIMITS.description) {
          return { ok: false, error: `The description can be at most ${LIMITS.description} characters.` };
        }
        const combined = tag ? `[${tag}] ${typed}` : typed;
        if (typed !== oneLine(text)) { next.description = combined; changed.push("description"); }
      }
      if (f.difficulty !== undefined) {
        const bad = checkEnum(f.difficulty, DIFFICULTIES, "Difficulty");
        if (bad) return { ok: false, error: bad };
        if (f.difficulty !== node.difficulty) { next.difficulty = f.difficulty; changed.push("difficulty"); }
      }
      if (f.type !== undefined) {
        const bad = checkEnum(f.type, NODE_TYPES, "Type");
        if (bad) return { ok: false, error: bad };
        if (f.type !== node.type) { next.type = f.type; changed.push("type"); }
      }
      if (f.duration !== undefined) {
        const d = oneLine(f.duration);
        if (!d) return { ok: false, error: "The duration can't be empty." };
        if (d.length > LIMITS.duration) return { ok: false, error: `The duration can be at most ${LIMITS.duration} characters.` };
        if (d !== node.duration) { next.duration = d; changed.push("duration"); }
      }
      if (changed.length === 0) return { ok: false, error: "Nothing was changed." };
      next.editedByInstructor = true;
      const result = nodes.map((n) => (n.nodeId === node.nodeId ? next : n));
      return finish(result, `Edited "${next.title}": changed ${changed.join(", ")}`, node.nodeId);
    }

    case "add": {
      if (nodes.length >= LIMITS.maxNodes) return { ok: false, error: `A pathway can have at most ${LIMITS.maxNodes} nodes.` };
      const n = edit.node;
      const title = oneLine(n?.title);
      if (!title) return { ok: false, error: "Give the new node a title." };
      if (title.length > LIMITS.title) return { ok: false, error: `The title can be at most ${LIMITS.title} characters.` };
      const description = splitBlockTag(oneLine(n?.description)).text;
      if (description.length > LIMITS.description) {
        return { ok: false, error: `The description can be at most ${LIMITS.description} characters.` };
      }
      const type = n?.type ?? "topic";
      const difficulty = n?.difficulty ?? "beginner";
      const duration = oneLine(n?.duration) || "30 min";
      const badType = checkEnum(type, NODE_TYPES, "Type");
      if (badType) return { ok: false, error: badType };
      const badDiff = checkEnum(difficulty, DIFFICULTIES, "Difficulty");
      if (badDiff) return { ok: false, error: badDiff };
      if (duration.length > LIMITS.duration) return { ok: false, error: `The duration can be at most ${LIMITS.duration} characters.` };
      const anchor = edit.afterNodeId;
      if (anchor !== null && !byId(anchor)) return { ok: false, error: "The node to insert after no longer exists." };

      const created: EditableNode = {
        nodeId: opts?.newNodeId ?? nextNodeId(new Set(nodes.map((x) => x.nodeId))),
        title, description, type, difficulty, duration,
        dependsOn: [],
        rationale: null,
        evidence: null,
        addedByInstructor: true,
        editedByInstructor: false,
      };
      const result = insertAfter(nodes, created, anchor);
      const where = anchor === null ? "at the start" : `after "${byId(anchor)!.title}"`;
      return finish(result, `Added "${title}" ${where}`, created.nodeId);
    }

    case "remove": {
      const node = byId(edit.nodeId);
      if (!node) return { ok: false, error: "That node no longer exists." };
      if (nodes.length <= 1) return { ok: false, error: "A pathway needs at least one node." };
      const result = removeWithBridge(nodes, edit.nodeId);
      return finish(result, `Removed "${node.title}"`, node.nodeId);
    }

    case "move": {
      const from = nodes.findIndex((n) => n.nodeId === edit.nodeId);
      if (from === -1) return { ok: false, error: "That node no longer exists." };
      const to = edit.toIndex;
      if (!Number.isInteger(to) || to < 0 || to >= nodes.length) return { ok: false, error: "That position doesn't exist." };
      if (to === from) return { ok: false, error: "The node is already in that position." };
      const moving = cloneNode(nodes[from]);
      const rest = removeWithBridge(nodes, edit.nodeId);
      const anchor = to === 0 ? null : rest[to - 1].nodeId;
      const result = insertAfter(rest, moving, anchor);
      return finish(result, `Moved "${moving.title}" from position ${from + 1} to ${to + 1}`, moving.nodeId);
    }

    default:
      return { ok: false, error: "Unknown edit." };
  }
}
