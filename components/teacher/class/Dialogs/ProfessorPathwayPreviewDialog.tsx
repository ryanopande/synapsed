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
import { CheckCircle, XCircle, RotateCcw, Eye, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import type { EvidenceItem } from "@/lib/learning-paths/explanationVerify";

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

  // Reset dialog state when it closes
  useEffect(() => {
    if (!open) {
      setIsLoading(false);
      setFocusText("");
      setShowRegenerate(false);
    }
  }, [open]);

  if (!pathway) return null;

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/pathway/professor/${classId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathwayId: pathway.id,
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
          pathwayId: pathway.id,
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
          studentId: pathway.studentId,
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
            Review the learning pathway for {pathway.studentName}
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
                  <p className="text-sm text-gray-600">{pathway.studentName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-gray-600">{pathway.studentEmail}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">{getStatusBadge(pathway.status)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Generated</Label>
                  <p className="text-sm text-gray-600">
                    {new Date(pathway.createdAt).toLocaleDateString()}
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
              {pathway.rationaleSummary ? (
                <p className="text-sm text-gray-700">{pathway.rationaleSummary}</p>
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
              <CardTitle className="text-lg">
                Pathway Nodes ({pathway.nodeCount} total)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pathway.nodes.map((node, index) => (
                  <div
                    key={node.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
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
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{node.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Duration: {node.duration}</span>
                          {node.dependsOn.length > 0 && (
                            <span>Depends on: {node.dependsOn.join(", ")}</span>
                          )}
                        </div>
                        {node.rationale ? (
                          <details className="mt-3 rounded-md bg-purple-50/60 border border-purple-100 px-3 py-2">
                            <summary className="cursor-pointer text-sm font-medium text-purple-800">
                              Why this node
                            </summary>
                            <div className="mt-2 space-y-2">
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Regenerate Section */}
          {pathway.status === "rejected" && (
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
          
          {pathway.status === "pending" && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isLoading}
                className="text-red-600 hover:text-red-700"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}

          {pathway.status === "rejected" && (
            <Button
              onClick={handleRegenerate}
              disabled={isLoading || !focusText.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
          )}

          {pathway.status === "approved" && (
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
