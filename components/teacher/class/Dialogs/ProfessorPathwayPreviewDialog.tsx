"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, RotateCcw, Eye, AlertTriangle, Info, Pencil, ArrowUp, ArrowDown, Trash2, Plus, Undo2, Check } from "lucide-react";
import { toast } from "sonner";
import type { EvidenceItem } from "@/lib/learning-paths/explanationVerify";
import { AddNodeForm, NodeEditForm, type NodeFields } from "./PathwayEditForms";

interface PathwayNode {
  id: string;
  nodeId: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  duration: string;
  dependsOn: string[];
  rationale?: string | null;
  evidence?: EvidenceItem[] | null;
  addedByInstructor?: boolean | null;
  editedByInstructor?: boolean | null;
}

interface HistoryEntry {
  id: string;
  action: string;
  summary: string;
  undone: boolean;
  createdAt: string;
}

interface PathwayData {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: string;
  professorNotes?: string;
  rationaleSummary?: string | null;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
  nodes: PathwayNode[];
  nodeCount: number;
}

interface ProfessorPathwayPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  pathway: PathwayData | null;
  classId: string;
  onPathwayUpdate: () => void;
}


const EXPLANATION_NOTE =
  "Written by the AI after the pathway was generated. It is the AI's account of why the pathway fits this learner, " +
  "not a record of how it was computed. Quoted survey answers are checked against what the learner actually wrote.";

function EvidenceLine({ item }: { item: EvidenceItem }) {
  const ok = item.verified;
  const mark = ok ? (
    <span className="inline-flex items-center gap-1 text-green-700">
      <CheckCircle className="w-3 h-3" /> checked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-amber-700">
      <AlertTriangle className="w-3 h-3" /> not found in the {item.kind === "survey" ? "learner's answers" : "course objectives"}
    </span>
  );

  return (
    <li className="text-xs text-gray-700">
      {item.kind === "survey" ? (
        <>
          <span className="font-medium">Learner wrote</span>
          {item.questionText ? <span className="text-gray-500"> (to &ldquo;{item.questionText}&rdquo;)</span> : null}
          : &ldquo;{item.quote}&rdquo;{" "}
        </>
      ) : (
        <>
          <span className="font-medium">Course objective:</span> {item.text}{" "}
        </>
      )}
      <span className="whitespace-nowrap">&middot; {mark}</span>
    </li>
  );
}

export default function ProfessorPathwayPreviewDialog({
  open,
  onClose,
  pathway,
  classId,
  onPathwayUpdate,
}: ProfessorPathwayPreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [focusText, setFocusText] = useState("");
  const [showRegenerate, setShowRegenerate] = useState(false);

  // Editing: `live` is the pathway as last saved by an edit (the parent only refreshes in the background)
  const [live, setLive] = useState<PathwayData | null>(pathway);
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Start from the pathway handed in whenever a (different) pathway is opened
  useEffect(() => {
    setLive(pathway);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathway?.id, open]);

  // Reset dialog state when it closes
  useEffect(() => {
    if (!open) {
      setIsLoading(false);
      setFocusText("");
      setShowRegenerate(false);
      setEditing(false);
      setEditBusy(false);
      setEditingNodeId(null);
      setRemoveConfirm(null);
      setAddOpen(false);
      setHistory([]);
      setCanUndo(false);
    }
  }, [open]);

  if (!pathway) return null;

  // What the screen shows: the latest saved edit, else the pathway passed in
  const view = live && live.id === pathway.id ? live : pathway;
  const titleOf = (nodeId: string) => view.nodes.find((n) => n.nodeId === nodeId)?.title ?? nodeId;

  const loadHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/learning-paths/${id}/edit`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.entries ?? []);
        setCanUndo(!!data.canUndo);
      } else if (res.status === 401 || res.status === 403) {
        toast("You can't edit this pathway", { description: "Only the professor who owns this class can change it." });
        setEditing(false);
      }
    } catch (error) {
      console.error("Error loading edit history:", error);
    }
  };

  const startEditing = () => {
    setEditing(true);
    setEditingNodeId(null);
    setRemoveConfirm(null);
    setAddOpen(false);
    void loadHistory(view.id);
  };

  const stopEditing = () => {
    setEditing(false);
    setEditingNodeId(null);
    setRemoveConfirm(null);
    setAddOpen(false);
  };

  // One edit = one request. The server applies it, saves it, and returns the updated pathway.
  const sendEdit = async (body: Record<string, unknown>): Promise<boolean> => {
    setEditBusy(true);
    try {
      const res = await fetch(`/api/learning-paths/${view.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast("Couldn't save that change", { description: data.message || "Please try again." });
        return false;
      }
      setLive(data.pathway);
      setCanUndo(!!data.canUndo);
      void loadHistory(view.id);
      onPathwayUpdate();
      toast(data.summary);
      return true;
    } catch (error) {
      console.error("Error editing pathway:", error);
      toast("Error", { description: "Failed to save the change." });
      return false;
    } finally {
      setEditBusy(false);
    }
  };

  const handleSaveNode = async (nodeId: string, fields: Partial<NodeFields>) => {
    if (await sendEdit({ action: "update", nodeId, fields })) setEditingNodeId(null);
  };
  const handleAddNode = async (node: NodeFields, afterNodeId: string | null) => {
    if (await sendEdit({ action: "add", node, afterNodeId })) setAddOpen(false);
  };
  const handleMove = (nodeId: string, toIndex: number) => sendEdit({ action: "move", nodeId, toIndex });
  const handleRemove = async (nodeId: string) => {
    setRemoveConfirm(null);
    await sendEdit({ action: "remove", nodeId });
  };
  const handleUndo = () => sendEdit({ action: "undo" });

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/pathway/professor/${classId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathwayId: view.id,
          status: "approved",
        }),
      });

      if (response.ok) {
        toast("Pathway approved", { description: "Student can now access this pathway." });
        onPathwayUpdate();
        onClose();
      } else {
        throw new Error("Failed to approve pathway");
      }
    } catch (error) {
      console.error("Error approving pathway:", error);
      toast("Error", { description: "Failed to approve pathway." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/pathway/professor/${classId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathwayId: view.id,
          status: "rejected",
        }),
      });

      if (response.ok) {
        toast("Pathway rejected", { description: "Student will not see this pathway." });
        onPathwayUpdate();
        onClose();
      } else {
        throw new Error("Failed to reject pathway");
      }
    } catch (error) {
      console.error("Error rejecting pathway:", error);
      toast("Error", { description: "Failed to reject pathway." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!focusText.trim()) {
      toast("Error", { description: "Please provide focus text for regeneration." });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/pathway/professor/${classId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: view.studentId,
          focusText: focusText.trim(),
        }),
      });

      if (response.ok) {
        toast("Pathway regenerated", { description: "New pathway is being generated with your focus." });
        onPathwayUpdate();
        onClose();
      } else {
        throw new Error("Failed to regenerate pathway");
      }
    } catch (error) {
      console.error("Error regenerating pathway:", error);
      toast("Error", { description: "Failed to regenerate pathway." });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "beginner":
        return "text-green-600 bg-green-50";
      case "intermediate":
        return "text-yellow-600 bg-yellow-50";
      case "advanced":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Pathway Preview
          </DialogTitle>
          <DialogDescription>
            Review the learning pathway for {view.studentName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Student Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Student Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Student Name</Label>
                  <p className="text-sm text-gray-600">{view.studentName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-gray-600">{view.studentEmail}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">{getStatusBadge(view.status)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Generated</Label>
                  <p className="text-sm text-gray-600">
                    {new Date(view.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Why this pathway */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Why this pathway
                <Badge variant="outline" className="text-purple-700 bg-purple-50" title={EXPLANATION_NOTE}>
                  AI-written explanation
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {view.rationaleSummary ? (
                <p className="text-sm text-gray-700">{view.rationaleSummary}</p>
              ) : (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Info className="w-4 h-4" /> No explanation was recorded for this pathway.
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">{EXPLANATION_NOTE}</p>
            </CardContent>
          </Card>

          {/* Pathway Nodes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">Pathway Nodes ({view.nodeCount} total)</CardTitle>
                {!editing ? (
                  <Button variant="outline" size="sm" onClick={startEditing} disabled={isLoading}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit pathway
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo || editBusy}>
                      <Undo2 className="w-4 h-4 mr-2" />
                      Undo last change
                    </Button>
                    <Button size="sm" onClick={stopEditing} disabled={editBusy}>
                      <Check className="w-4 h-4 mr-2" />
                      Done editing
                    </Button>
                  </div>
                )}
              </div>
              {editing && (
                <p className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-2 mt-2">
                  Changes are saved as you make them. Editing sends this pathway back to &ldquo;Pending&rdquo; so you can
                  approve your version, and prerequisites are kept in step automatically.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {view.nodes.map((node, index) => (
                  <div
                    key={node.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-500">
                            {index + 1}.
                          </span>
                          <h4 className="font-medium">{node.title}</h4>
                          <Badge
                            variant="outline"
                            className={getDifficultyColor(node.difficulty)}
                          >
                            {node.difficulty}
                          </Badge>
                          <Badge variant="outline" className="text-blue-600 bg-blue-50">
                            {node.type}
                          </Badge>
                          {node.addedByInstructor && (
                            <Badge variant="outline" className="text-green-700 bg-green-50">Added by you</Badge>
                          )}
                          {node.editedByInstructor && (
                            <Badge variant="outline" className="text-amber-700 bg-amber-50">Edited by you</Badge>
                          )}
                        </div>

                        {editing && editingNodeId === node.nodeId ? (
                          <NodeEditForm
                            node={node}
                            busy={editBusy}
                            onSave={(changes) => handleSaveNode(node.nodeId, changes)}
                            onCancel={() => setEditingNodeId(null)}
                          />
                        ) : (
                          <>
                            <p className="text-sm text-gray-600 mb-2">{node.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                              <span>Duration: {node.duration}</span>
                              {node.dependsOn.length > 0 && (
                                <span>Depends on: {node.dependsOn.map(titleOf).join(", ")}</span>
                              )}
                            </div>
                            {node.addedByInstructor ? (
                              <p className="mt-3 text-xs text-gray-500">
                                Added by you, so there is no AI explanation for this node.
                              </p>
                            ) : node.rationale ? (
                              <details className="mt-3 rounded-md bg-purple-50/60 border border-purple-100 px-3 py-2">
                                <summary className="cursor-pointer text-sm font-medium text-purple-800">
                                  Why this node
                                </summary>
                                <div className="mt-2 space-y-2">
                                  {node.editedByInstructor && (
                                    <p className="text-xs text-amber-700">
                                      You edited this node after the AI wrote this explanation, so it may no longer match.
                                    </p>
                                  )}
                                  <p className="text-sm text-gray-700">{node.rationale}</p>
                                  {node.evidence && node.evidence.length > 0 ? (
                                    <ul className="space-y-1 list-disc pl-4">
                                      {node.evidence.map((item, i) => (
                                        <EvidenceLine key={i} item={item} />
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-gray-500">
                                      No specific survey answer is cited for this node.
                                    </p>
                                  )}
                                  <p className="text-[11px] text-gray-400">AI-written explanation</p>
                                </div>
                              </details>
                            ) : (
                              <p className="mt-3 text-xs text-gray-400">No explanation recorded for this node.</p>
                            )}
                          </>
                        )}
                      </div>

                      {editing && editingNodeId !== node.nodeId && (
                        <div className="flex flex-col gap-1 shrink-0 items-end">
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Move up"
                              title="Move up"
                              disabled={index === 0 || editBusy}
                              onClick={() => handleMove(node.nodeId, index - 1)}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Move down"
                              title="Move down"
                              disabled={index === view.nodes.length - 1 || editBusy}
                              onClick={() => handleMove(node.nodeId, index + 1)}
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Edit node"
                              title="Edit this node"
                              disabled={editBusy}
                              onClick={() => {
                                setRemoveConfirm(null);
                                setEditingNodeId(node.nodeId);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {removeConfirm !== node.nodeId && (
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Remove node"
                                title="Remove this node"
                                disabled={view.nodes.length <= 1 || editBusy}
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setRemoveConfirm(node.nodeId)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          {removeConfirm === node.nodeId && (
                            <div className="flex gap-1 items-center">
                              <span className="text-xs text-gray-600">Remove this node?</span>
                              <Button size="sm" variant="destructive" disabled={editBusy} onClick={() => handleRemove(node.nodeId)}>
                                Remove
                              </Button>
                              <Button size="sm" variant="outline" disabled={editBusy} onClick={() => setRemoveConfirm(null)}>
                                Keep
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {editing && (
                <div className="mt-4 space-y-3">
                  {addOpen ? (
                    <AddNodeForm
                      nodes={view.nodes}
                      busy={editBusy}
                      onAdd={handleAddNode}
                      onCancel={() => setAddOpen(false)}
                    />
                  ) : (
                    <Button variant="outline" onClick={() => setAddOpen(true)} disabled={editBusy}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add a node
                    </Button>
                  )}
                  {history.length > 0 && (
                    <details className="text-xs text-gray-600">
                      <summary className="cursor-pointer font-medium">Change log ({history.length})</summary>
                      <ul className="mt-2 space-y-1">
                        {history.map((h) => (
                          <li key={h.id} className={h.undone ? "line-through text-gray-400" : ""}>
                            {new Date(h.createdAt).toLocaleTimeString()} &middot; {h.summary}
                            {h.undone ? " (undone)" : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Regenerate Section */}
          {view.status === "rejected" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Regenerate Pathway</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="focus-text">
                      What should the new pathway focus on?
                    </Label>
                    <Textarea
                      id="focus-text"
                      placeholder="e.g., Focus more on practical applications, include more advanced topics, emphasize problem-solving..."
                      value={focusText}
                      onChange={(e) => setFocusText(e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Close
          </Button>
          
          {view.status === "pending" && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isLoading || editBusy}
                className="text-red-600 hover:text-red-700"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isLoading || editBusy}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}

          {view.status === "rejected" && (
            <Button
              onClick={handleRegenerate}
              disabled={isLoading || !focusText.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
          )}

          {view.status === "approved" && (
            <Button
              variant="outline"
              onClick={() => setShowRegenerate(!showRegenerate)}
              className="text-blue-600 hover:text-blue-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
