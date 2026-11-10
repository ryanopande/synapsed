"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Answer = {
  question: string;
  answer: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onGenerate?: () => void;
  studentName?: string;
  completedAt?: string;
  answers?: Answer[];
};

export default function StudentSurveyDialog({
  open,
  onClose,
  onGenerate,
  studentName,
  completedAt,
  answers = [],
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Survey Responses - {studentName}</DialogTitle>
          <DialogDescription>
            View student responses submitted on {completedAt && new Date(completedAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {answers.length > 0 ? (
            answers.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <h4 className="font-medium">Question {idx + 1}: {item.question}</h4>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm">{item.answer}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No answers submitted.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onGenerate && (
            <Button
              onClick={() => {
                onGenerate();
                toast("Learning path generated", {
                  description: `Personalized learning path created for ${studentName}`,
                });
                onClose();
              }}
            >
              Generate Learning Path
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}