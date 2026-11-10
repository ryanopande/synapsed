"use client"

import { useState, useEffect } from "react"
import { GripVertical, Plus, Copy, Trash, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type Question = {
  id: string
  text: string
  type: 'multiple_choice' | 'text' | 'rating' | 'ranking'
  options?: string[]
  required: boolean
  order: number
  duplicatedFrom?: string
}

type Survey = {
  id: string
  classId: string
  title: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  questions: Question[]
  publishedAt?: string
  createdAt: string
}

interface SurveyEditorProps {
  open: boolean
  onClose: () => void
  survey: Survey
  onSave: () => void
}

export function SurveyEditor({ open, onClose, survey, onSave }: SurveyEditorProps) {
  const [title, setTitle] = useState(survey.title)
  const [questions, setQuestions] = useState<Question[]>(survey.questions || [])
  const [isSaving, setIsSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [conflictData, setConflictData] = useState<{title: string} | null>(null)

  useEffect(() => {
    setTitle(survey.title)
    setQuestions(survey.questions || [])
  }, [survey])

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: "",
      type: "text",
      required: true,
      order: questions.length + 1,
    }
    setQuestions([...questions, newQuestion])
  }

  const handleUpdateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(
      questions.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      )
    )
  }

  const handleDuplicateQuestion = (id: string) => {
    const questionIndex = questions.findIndex((q) => q.id === id)
    if (questionIndex === -1) return

    const original = questions[questionIndex]
    const duplicate: Question = {
      ...original,
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: `${original.text} (Copy)`,
      duplicatedFrom: id,
    }

    const newQuestions = [
      ...questions.slice(0, questionIndex + 1),
      duplicate,
      ...questions.slice(questionIndex + 1),
    ]

    // Reorder
    setQuestions(
      newQuestions.map((q, index) => ({ ...q, order: index + 1 }))
    )
  }

  const handleDeleteQuestion = (id: string) => {
    const newQuestions = questions.filter((q) => q.id !== id)
    // Reorder
    setQuestions(
      newQuestions.map((q, index) => ({ ...q, order: index + 1 }))
    )
  }

  const handleAddOption = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId)
    if (!question) return

    const options = question.options || []
    handleUpdateQuestion(questionId, {
      options: [...options, ""],
    })
  }

  const handleUpdateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = questions.find((q) => q.id === questionId)
    if (!question || !question.options) return

    const newOptions = [...question.options]
    newOptions[optionIndex] = value
    handleUpdateQuestion(questionId, { options: newOptions })
  }

  const handleDeleteOption = (questionId: string, optionIndex: number) => {
    const question = questions.find((q) => q.id === questionId)
    if (!question || !question.options) return

    const newOptions = question.options.filter((_, i) => i !== optionIndex)
    handleUpdateQuestion(questionId, { options: newOptions })
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newQuestions = [...questions]
    const draggedItem = newQuestions[draggedIndex]
    newQuestions.splice(draggedIndex, 1)
    newQuestions.splice(index, 0, draggedItem)

    setQuestions(
      newQuestions.map((q, i) => ({ ...q, order: i + 1 }))
    )
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleSave = async (publish: boolean = false, forcePublish: boolean = false) => {
    if (!title.trim()) {
      toast("Error", {
        description: "Please provide a survey title"
      })
      return
    }

    if (questions.length === 0) {
      toast("Error", {
        description: "Please add at least one question"
      })
      return
    }

    // Validate questions
    for (const q of questions) {
      if (!q.text.trim()) {
        toast("Error", {
          description: "All questions must have text"
        })
        return
      }

      if ((q.type === 'multiple_choice' || q.type === 'ranking') && (!q.options || q.options.length < 2)) {
        toast("Error", {
          description: `Question "${q.text}" needs at least 2 options`
        })
        return
      }
    }

    try {
      setIsSaving(true)

      // Save survey
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: survey.id || undefined,
          classId: survey.classId,
          title,
          questions,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save survey')
      }

      const data = await response.json()

      // If publish is requested, publish the survey
      if (publish && data.survey) {
        const publishResponse = await fetch(`/api/surveys/${data.survey.id}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forcePublish }),
        })

        if (publishResponse.status === 409 && !forcePublish) {
          // Conflict - another survey is active
          const publishData = await publishResponse.json()
          
          // Show React dialog instead of native confirm
          setConflictData(publishData.existingSurvey)
          setShowConflictDialog(true)
          return
        } else if (!publishResponse.ok) {
          throw new Error('Failed to publish survey')
        } else {
          const publishData = await publishResponse.json()
          toast("Survey published", {
            description: publishData.archivedPrevious
              ? "Previous active survey was archived. Your survey has been published."
              : "Your survey has been saved and published"
          })
        }
      } else {
        toast("Survey saved", {
          description: "Your survey has been saved as a draft"
        })
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Error saving survey:', error)
      toast("Error", {
        description: error instanceof Error ? error.message : "Failed to save survey"
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Survey Editor</DialogTitle>
          <DialogDescription>
            Create and edit survey questions. Drag questions to reorder them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Survey Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Survey Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter survey title..."
            />
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Questions</h3>
              <Button onClick={handleAddQuestion} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-md">
                No questions yet. Click &quot;Add Question&quot; to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <Card
                    key={question.id}
                    className="p-4"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start gap-2">
                        <div className="cursor-move pt-2">
                          <GripVertical className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="flex-1 space-y-4">
                          {/* Question Text */}
                          <div className="space-y-2">
                            <Label>Question {index + 1}</Label>
                            <Textarea
                              value={question.text}
                              onChange={(e) =>
                                handleUpdateQuestion(question.id, { text: e.target.value })
                              }
                              placeholder="Enter your question..."
                              rows={2}
                            />
                          </div>

                          {/* Question Type */}
                          <div className="space-y-2">
                            <Label>Question Type</Label>
                            <select
                              value={question.type}
                              onChange={(e) => {
                                const newType = e.target.value as Question['type']
                                const updates: Partial<Question> = { type: newType }
                                
                                // Initialize options for types that need them
                                if ((newType === 'multiple_choice' || newType === 'ranking') && !question.options) {
                                  updates.options = ["", ""]
                                }
                                
                                handleUpdateQuestion(question.id, updates)
                              }}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="text">Text (Short Answer)</option>
                              <option value="multiple_choice">Multiple Choice</option>
                              <option value="rating">Rating Scale</option>
                              <option value="ranking">Ranking</option>
                            </select>
                          </div>

                          {/* Options for multiple choice and ranking */}
                          {(question.type === 'multiple_choice' || question.type === 'ranking') && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Options</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddOption(question.id)}
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  Add Option
                                </Button>
                              </div>
                              {(question.options || []).map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center gap-2">
                                  <Input
                                    value={option}
                                    onChange={(e) =>
                                      handleUpdateOption(question.id, optionIndex, e.target.value)
                                    }
                                    placeholder={`Option ${optionIndex + 1}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteOption(question.id, optionIndex)}
                                  >
                                    ×
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Required checkbox */}
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`required-${question.id}`}
                              checked={question.required}
                              onChange={(e) =>
                                handleUpdateQuestion(question.id, { required: e.target.checked })
                              }
                              className="h-4 w-4"
                            />
                            <Label htmlFor={`required-${question.id}`} className="cursor-pointer">
                              Required question
                            </Label>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateQuestion(question.id)}
                            title="Duplicate question"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="text-destructive hover:text-destructive"
                            title="Delete question"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleSave(false)} 
            disabled={isSaving}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save & Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Conflict Confirmation Dialog */}
    <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Another Survey is Active</DialogTitle>
          <DialogDescription>
            Another survey &quot;{conflictData?.title}&quot; is already active for this class.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Do you want to archive the existing survey and activate this one instead?
          </p>
          <p className="text-sm font-medium">
            Note: Students can only see one active survey at a time.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowConflictDialog(false)
              setIsSaving(false)
              toast("Survey saved", {
                description: "Your survey has been saved as a draft"
              })
              onSave()
              onClose()
            }}
          >
            Keep as Draft
          </Button>
          <Button
            onClick={async () => {
              setShowConflictDialog(false)
              // Retry with forcePublish
              await handleSave(true, true)
            }}
          >
            Archive Old & Activate This
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

