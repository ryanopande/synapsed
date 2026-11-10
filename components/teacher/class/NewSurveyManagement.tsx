"use client"

import { useState } from "react"
import useSWR from "swr"
import { Copy, Edit, MoreHorizontal, Plus, Sparkles, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
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
import { SurveyEditor } from "./SurveyEditor"
import { StudentProgressTable } from "./StudentProgressTable"

type Survey = {
  id: string
  classId: string
  title: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  questions: Question[]
  publishedAt?: string
  createdAt: string
  _count?: {
    responses: number
  }
}

type Question = {
  id: string
  text: string
  type: 'multiple_choice' | 'text' | 'rating' | 'ranking'
  options?: string[]
  required: boolean
  order: number
  duplicatedFrom?: string
}

export function NewSurveyManagement({ classId }: { classId: string }) {
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false)
  const [aiContext, setAiContext] = useState("")
  const [aiSubject, setAiSubject] = useState("")
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  // Fetcher for surveys
  const surveysFetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch surveys');
    const data = await response.json();
    return data.surveys || [];
  };

  // Use SWR for surveys (cached and fast)
  const { data: surveys = [], isLoading: loadingSurveys, mutate: mutateSurveys } = useSWR<Survey[]>(
    classId ? `/api/surveys?classId=${classId}` : null,
    surveysFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  const handleCreateNew = () => {
    // Create a blank survey to edit
    setSelectedSurvey({
      id: '',
      classId,
      title: 'New Survey',
      status: 'DRAFT',
      questions: [],
      createdAt: new Date().toISOString(),
    })
    setIsEditorOpen(true)
  }

  const handleGenerateAI = async () => {
    if (!aiSubject.trim()) {
      toast("Error", {
        description: "Please provide a subject or context"
      })
      return
    }

    try {
      setIsGeneratingAI(true)
      const response = await fetch('/api/surveys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          context: aiContext,
          subject: aiSubject,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast("Survey generated", {
          description: "AI has generated a survey. Opening editor..."
        })
        setIsAIDialogOpen(false)
        setAiContext("")
        setAiSubject("")
        
        // Open the generated survey in editor
        setSelectedSurvey(data.survey)
        setIsEditorOpen(true)
        mutateSurveys()
      } else {
        throw new Error('Failed to generate survey')
      }
    } catch (error) {
      console.error('Error generating survey:', error)
      toast("Error", {
        description: "Failed to generate survey with AI"
      })
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handleDuplicate = async (survey: Survey) => {
    try {
      const response = await fetch(`/api/surveys/${survey.id}/duplicate`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        toast("Survey duplicated", {
          description: "Opening duplicated survey in editor..."
        })
        setSelectedSurvey(data.survey)
        setIsEditorOpen(true)
        mutateSurveys()
      } else {
        throw new Error('Failed to duplicate survey')
      }
    } catch (error) {
      console.error('Error duplicating survey:', error)
      toast("Error", {
        description: "Failed to duplicate survey"
      })
    }
  }

  const handleEdit = (survey: Survey) => {
    if (survey.status !== 'DRAFT') {
      toast("Error", {
        description: "Only draft surveys can be edited. Duplicate this survey to make changes."
      })
      return
    }
    setSelectedSurvey(survey)
    setIsEditorOpen(true)
  }

  const handlePublish = async (survey: Survey, forcePublish = false) => {
    try {
      const response = await fetch(`/api/surveys/${survey.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forcePublish }),
      })

      if (response.ok) {
        const data = await response.json()
        toast("Survey published", {
          description: data.archivedPrevious 
            ? "Previous active survey was archived. Students can now access this survey."
            : "Students can now access this survey"
        })
        mutateSurveys()
      } else if (response.status === 409) {
        // Conflict - another survey is active
        const data = await response.json()
        
        // Show confirmation dialog
        const confirmed = confirm(
          `Another survey "${data.existingSurvey.title}" is already active for this class.\n\n` +
          `Do you want to archive it and publish this survey instead?\n\n` +
          `Note: Students will only see one active survey at a time.`
        )
        
        if (confirmed) {
          // Retry with forcePublish
          await handlePublish(survey, true)
        }
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to publish survey')
      }
    } catch (error) {
      console.error('Error publishing survey:', error)
      toast("Error", {
        description: error instanceof Error ? error.message : "Failed to publish survey"
      })
    }
  }

  const handleArchive = async (survey: Survey) => {
    try {
      const response = await fetch(`/api/surveys/${survey.id}/archive`, {
        method: 'POST',
      })

      if (response.ok) {
        toast("Survey archived", {
          description: "Survey has been moved to archives"
        })
        mutateSurveys()
      } else {
        throw new Error('Failed to archive survey')
      }
    } catch (error) {
      console.error('Error archiving survey:', error)
      toast("Error", {
        description: "Failed to archive survey"
      })
    }
  }

  const handleDelete = async (survey: Survey) => {
    if (survey.status !== 'DRAFT') {
      toast("Error", {
        description: "Only draft surveys can be deleted"
      })
      return
    }

    if (!confirm('Are you sure you want to delete this survey? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/surveys?id=${survey.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast("Survey deleted", {
          description: "Survey has been permanently deleted"
        })
        mutateSurveys()
      } else {
        throw new Error('Failed to delete survey')
      }
    } catch (error) {
      console.error('Error deleting survey:', error)
      toast("Error", {
        description: "Failed to delete survey"
      })
    }
  }

  const getStatusBadge = (status: Survey['status']) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Draft</Badge>
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>
      case 'ARCHIVED':
        return <Badge variant="outline" className="text-gray-500 border-gray-300">Archived</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Survey & Learning Path Management</h2>
        <p className="text-muted-foreground">Create surveys and generate personalized learning paths.</p>
      </div>

      {/* Survey Management Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Surveys</CardTitle>
            <CardDescription>Manage your student surveys</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsAIDialogOpen(true)}
              className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create Manually
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Questions</TableHead>
                  <TableHead className="hidden md:table-cell">Responses</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSurveys ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                ) : surveys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No surveys yet. Create your first survey to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  surveys.map((survey) => (
                    <TableRow key={survey.id} className={survey.status === 'ACTIVE' ? 'bg-emerald-50/50' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {survey.title}
                          {survey.status === 'ACTIVE' && (
                            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                              Visible to Students
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(survey.status)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {Array.isArray(survey.questions) ? survey.questions.length : 0}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {survey._count?.responses || 0}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {new Date(survey.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Edit - Only for DRAFT */}
                            {survey.status === 'DRAFT' && (
                              <DropdownMenuItem onClick={() => handleEdit(survey)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}

                            {/* Activate - For DRAFT and ARCHIVED */}
                            {(survey.status === 'DRAFT' || survey.status === 'ARCHIVED') && (
                              <DropdownMenuItem onClick={() => handlePublish(survey)}>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Activate Survey
                              </DropdownMenuItem>
                            )}

                            {/* Deactivate - Only for ACTIVE */}
                            {survey.status === 'ACTIVE' && (
                              <DropdownMenuItem onClick={() => handleArchive(survey)}>
                                Archive (Deactivate)
                              </DropdownMenuItem>
                            )}

                            {/* Duplicate - For all surveys */}
                            <DropdownMenuItem onClick={() => handleDuplicate(survey)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>

                            {/* Delete - Only for DRAFT */}
                            {survey.status === 'DRAFT' && (
                              <DropdownMenuItem 
                                onClick={() => handleDelete(survey)}
                                className="text-destructive"
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Student Progress Table */}
      <StudentProgressTable classId={classId} surveys={surveys} />

      {/* AI Generation Dialog */}
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Survey with AI</DialogTitle>
            <DialogDescription>
              Provide context about your course and let AI generate a personalized survey
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={aiSubject}
                onChange={(e) => setAiSubject(e.target.value)}
                placeholder="e.g., Advanced Physics, Linear Algebra"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="context">Additional Context (optional)</Label>
              <Textarea
                id="context"
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                placeholder="Provide any specific topics, learning outcomes, or areas you want the survey to focus on..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAIDialogOpen(false)} disabled={isGeneratingAI}>
              Cancel
            </Button>
            <Button onClick={handleGenerateAI} disabled={isGeneratingAI}>
              {isGeneratingAI ? "Generating..." : "Generate Survey"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Survey Editor Dialog */}
      {selectedSurvey && (
        <SurveyEditor
          open={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false)
            setSelectedSurvey(null)
            mutateSurveys()
          }}
          survey={selectedSurvey}
          onSave={() => {
            mutateSurveys()
          }}
        />
      )}
    </div>
  )
}

