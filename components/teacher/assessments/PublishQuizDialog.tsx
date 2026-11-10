"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Checkbox } from "@/components/ui/checkbox";

interface PublishQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen due date, or undefined for no due date. */
  onPublish: (dueDate: Date | undefined) => Promise<void>;
  isLoading?: boolean;
  /** "publish" publishes the quiz; "edit-due-date" only changes the due date of a published quiz. */
  mode?: "publish" | "edit-due-date";
  /** Existing due date, shown when the dialog opens. */
  initialDueDate?: Date | string | null;
}

export function PublishQuizDialog({
  open,
  onOpenChange,
  onPublish,
  isLoading = false,
  mode = "publish",
  initialDueDate,
}: PublishQuizDialogProps) {
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [hasDueDate, setHasDueDate] = useState(false);

  // Start from the quiz's current due date each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const initial = initialDueDate ? new Date(initialDueDate) : undefined;
    const valid = initial && !isNaN(initial.getTime()) ? initial : undefined;
    setDueDate(valid);
    setHasDueDate(!!valid);
  }, [open, initialDueDate]);

  const isPast = !!dueDate && dueDate.getTime() <= Date.now();
  const canSubmit = !isLoading && (!hasDueDate || (!!dueDate && !isPast));
  const isEdit = mode === "edit-due-date";

  const handleSubmit = async () => {
    await onPublish(hasDueDate ? dueDate : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Change Due Date" : "Publish Quiz"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Set a new date and time students must submit by, or remove the due date."
              : "Make this quiz visible to all students in the class. You can set a date and time it's due."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has-due-date"
              checked={hasDueDate}
              onCheckedChange={(checked) => {
                setHasDueDate(checked === true);
                if (!checked) setDueDate(undefined);
              }}
            />
            <Label htmlFor="has-due-date" className="text-sm font-medium leading-none">
              Set due date
            </Label>
          </div>
          {hasDueDate && (
            <div className="space-y-3">
              <DateTimePicker value={dueDate} onChange={setDueDate} />
              {dueDate ? (
                <p className={`text-sm font-medium ${isPast ? "text-destructive" : "text-emerald-700"}`}>
                  {isPast
                    ? "That time has already passed. Pick a later date or time."
                    : `Due ${format(dueDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}`}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Pick a day, then adjust the time if needed.</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isLoading
              ? isEdit
                ? "Saving..."
                : "Publishing..."
              : isEdit
                ? "Save Due Date"
                : "Publish Quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
