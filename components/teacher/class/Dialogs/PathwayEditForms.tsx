"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DIFFICULTIES, LIMITS, NODE_TYPES, splitBlockTag } from "@/lib/learning-paths/pathwayEditing";

export type NodeFields = {
  title: string;
  description: string;
  difficulty: string;
  type: string;
  duration: string;
};

type NodeLike = {
  nodeId: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  duration: string;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Inline form for changing an existing node. Sends only the fields that actually changed. */
export function NodeEditForm({
  node,
  busy,
  onSave,
  onCancel,
}: {
  node: NodeLike;
  busy: boolean;
  onSave: (changes: Partial<NodeFields>) => void;
  onCancel: () => void;
}) {
  // The internal "[block_01]" tag is not shown for editing; the server keeps it.
  const original: NodeFields = {
    title: node.title,
    description: splitBlockTag(node.description).text,
    difficulty: node.difficulty,
    type: node.type,
    duration: node.duration,
  };
  const [f, setF] = useState<NodeFields>(original);
  const set = (k: keyof NodeFields, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const changes: Partial<NodeFields> = {};
  (Object.keys(original) as (keyof NodeFields)[]).forEach((k) => {
    if (f[k].trim() !== original[k].trim()) changes[k] = f[k];
  });
  const canSave = !busy && f.title.trim().length > 0 && Object.keys(changes).length > 0;

  return (
    <div className="mt-2 space-y-3 rounded-md border border-blue-200 bg-blue-50/50 p-3">
      <div>
        <Label htmlFor={`t-${node.nodeId}`} className="text-xs">Title</Label>
        <Input id={`t-${node.nodeId}`} value={f.title} maxLength={LIMITS.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`d-${node.nodeId}`} className="text-xs">Description</Label>
        <Textarea id={`d-${node.nodeId}`} rows={3} value={f.description} maxLength={LIMITS.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Difficulty</Label>
          <select className={selectClass} value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <select className={selectClass} value={f.type} onChange={(e) => set("type", e.target.value)}>
            {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Duration</Label>
          <Input value={f.duration} maxLength={LIMITS.duration} onChange={(e) => set("duration", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(changes)} disabled={!canSave}>Save changes</Button>
      </div>
    </div>
  );
}

/** Form for adding a node; the instructor picks where it goes. */
export function AddNodeForm({
  nodes,
  busy,
  onAdd,
  onCancel,
}: {
  nodes: { nodeId: string; title: string }[];
  busy: boolean;
  onAdd: (node: NodeFields, afterNodeId: string | null) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<NodeFields>({ title: "", description: "", difficulty: "beginner", type: "topic", duration: "30 min" });
  const [after, setAfter] = useState<string>(nodes.length > 0 ? nodes[nodes.length - 1].nodeId : "__start__");
  const set = (k: keyof NodeFields, v: string) => setF((prev) => ({ ...prev, [k]: v }));
  const canAdd = !busy && f.title.trim().length > 0;

  return (
    <div className="space-y-3 rounded-md border border-green-200 bg-green-50/50 p-4">
      <p className="text-sm font-medium">Add a node</p>
      <div>
        <Label htmlFor="add-title" className="text-xs">Title</Label>
        <Input id="add-title" value={f.title} maxLength={LIMITS.title} placeholder="e.g. Checking an AI answer against a source" onChange={(e) => set("title", e.target.value)} />
      </div>
      <div>
        <Label htmlFor="add-desc" className="text-xs">Description</Label>
        <Textarea id="add-desc" rows={3} value={f.description} maxLength={LIMITS.description} placeholder="What the learner will do in this node" onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Difficulty</Label>
          <select className={selectClass} value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <select className={selectClass} value={f.type} onChange={(e) => set("type", e.target.value)}>
            {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Duration</Label>
          <Input value={f.duration} maxLength={LIMITS.duration} onChange={(e) => set("duration", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Place it</Label>
          <select className={selectClass} value={after} onChange={(e) => setAfter(e.target.value)}>
            <option value="__start__">At the start</option>
            {nodes.map((n, i) => (
              <option key={n.nodeId} value={n.nodeId}>
                After {i + 1}. {n.title.length > 28 ? n.title.slice(0, 27) + "…" : n.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button size="sm" onClick={() => onAdd(f, after === "__start__" ? null : after)} disabled={!canAdd}>Add node</Button>
      </div>
    </div>
  );
}
