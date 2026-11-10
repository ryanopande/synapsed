"use client";

import { useState } from "react";
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
  onPublish: (dueDate: Date | undefined) => Promise<void>;
  isLoading?: boolean;
}

export function PublishQuizDialog({
  open,
  onOpenChange,
  onPublish,
  isLoading = false,
}: PublishQuizDialogProps) {
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [hasDueDate, setHasDueDate] = useState(false);

  const handlePublish = async () => {
    await onPublish(hasDueDate ? dueDate : undefined);
    // Reset form
    setDueDate(undefined);
    setHasDueDate(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish Quiz</DialogTitle>
          <DialogDescription>
            Make this quiz visible to all students in the class. You can optionally set a due date.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has-due-date"
              checked={hasDueDate}
              onCheckedChange={(checked) => {
                setHasDueDate(checked === true);
                if (!checked) {
                  setDueDate(undefined);
                }
              }}
            />
            <Label
              htmlFor="has-due-date"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Set due date
            </Label>
          </div>
          {hasDueDate && (
            <div className="space-y-2">
              <Label>Due Date & Time</Label>
              <DateTimePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Select due date and time"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={isLoading || (hasDueDate && !dueDate)}>
            {isLoading ? "Publishing..." : "Publish Quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

