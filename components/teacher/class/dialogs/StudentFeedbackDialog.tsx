"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ClassFeedback } from "@/lib/students/feedback"

interface StudentFeedbackResponse {
  student: { id: string; name: string | null; email: string }
  feedback: ClassFeedback | null
}

interface StudentFeedbackDialogProps {
  classId: string
  student: { id: string; name: string } | null
  onOpenChange: (open: boolean) => void
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to load student progress")
  return res.json()
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString()

function ProgressRow({ label, detail, percent }: { label: string; detail: string; percent: number | null }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <span>{detail}</span>
      </div>
      <Progress value={percent ?? 0} className="h-2" />
    </div>
  )
}

export function StudentFeedbackDialog({ classId, student, onOpenChange }: StudentFeedbackDialogProps) {
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const url = student ? `/api/professor/feedback/${classId}/${student.id}` : null
  const { data, error, isLoading, mutate } = useSWR<StudentFeedbackResponse>(url, fetcher)
  const feedback = data?.feedback

  const handleSend = async () => {
    if (!url || !message.trim()) return
    setSaving(true)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Failed to save feedback")
      }
      toast.success("Feedback sent", { description: `${student?.name} can now see it on their Feedback page.` })
      setMessage("")
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save feedback")
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) setMessage("")
    onOpenChange(open)
  }

  return (
    <Dialog open={!!student} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feedback for {student?.name}</DialogTitle>
          <DialogDescription>
            Review their progress, then write feedback. It appears on the student&apos;s Feedback page.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading progress...</p>
        ) : error || !feedback ? (
          <p className="text-sm text-destructive">Could not load this student&apos;s progress.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <ProgressRow
                label="Pathway"
                detail={
                  feedback.lessons.total > 0
                    ? `${feedback.lessons.completed}/${feedback.lessons.total} · ${feedback.lessons.percent}%`
                    : "No approved pathway"
                }
                percent={feedback.lessons.percent}
              />
              <ProgressRow
                label="Quizzes submitted"
                detail={
                  feedback.quizzes.total > 0
                    ? `${feedback.quizzes.completed}/${feedback.quizzes.total} · ${feedback.quizzes.percent}%`
                    : "No published quizzes"
                }
                percent={feedback.quizzes.percent}
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Quiz scores</h4>
              {feedback.professorQuizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quizzes submitted yet.</p>
              ) : (
                <ul className="text-sm divide-y rounded-md border">
                  {feedback.professorQuizzes.map((q) => (
                    <li key={q.quizId} className="flex justify-between gap-3 px-3 py-2">
                      <span className="truncate">{q.title}</span>
                      <span className="shrink-0 font-medium">{q.score === null ? "Not scored" : `${q.score}%`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Pop quizzes in the AI tutor</h4>
              {feedback.popQuizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pop quizzes taken yet.</p>
              ) : (
                <ul className="text-sm divide-y rounded-md border">
                  {feedback.popQuizzes.map((q) => (
                    <li key={q.id} className="flex justify-between gap-3 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate">{q.topic}</span>
                        <span className="block text-xs text-muted-foreground">
                          {q.lesson ? `${q.lesson.title} · ` : ""}
                          {formatDate(q.submittedAt)}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium">{q.score === null ? "Not scored" : `${q.score}%`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {feedback.professorFeedback.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Feedback you&apos;ve given</h4>
                {feedback.professorFeedback.map((note) => (
                  <div key={note.id} className="rounded-md border-l-4 border-primary bg-muted/40 px-3 py-2 text-sm">
                    <p className="whitespace-pre-wrap">{note.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">New feedback</h4>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Great progress on the pathway! Revisit the transformers lesson before the next quiz."
                rows={4}
                maxLength={5000}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSend} disabled={saving || !message.trim() || !feedback}>
            {saving ? "Sending..." : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
