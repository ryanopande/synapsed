"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { Edit, Eye, MoreHorizontal, Plus, Sparkles } from "lucide-react"
import StudentSurveyDialog from "./Dialogs/StudentViewSurveyAnswerDialog";
import SurveyTemplateDialog from "./Dialogs/SurveyTemplateDialog";
import ProfessorPathwayPreviewDialog from "./Dialogs/ProfessorPathwayPreviewDialog";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { PathwayData } from "@/lib/types/pathwayTypes"

// Real learning paths will be fetched from API

type SurveyResponse = {
  studentId: string;
  name: string;
  submittedAt: string;
  answers: { question: string; answer: string }[];
};

type SurveyQuestion = { id: string; text: string; type: string; options?: string[] };



export function SurveyLearningPath({ classId }: { classId: string }) {
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [selectedPath, setSelectedPath] = useState<PathwayData | null>(null)
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [isSurveyBuilderOpen, setIsSurveyBuilderOpen] = useState(false)
  const [isSurveyViewOpen, setIsSurveyViewOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([])
  const [selectedStudentResponse, setSelectedStudentResponse] = useState<SurveyResponse | null>(null);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false)
  
  // Fetcher for survey questions
  const surveyFetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch survey');
    const data = await res.json();
    return data?.questions || [];
  };

  // Fetcher for survey responses
  const surveyResponsesFetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch survey responses');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  // Fetcher for pathways
  const pathwaysFetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch pathways');
    const data = await res.json();
    return data.pathways || [];
  };

  // Use SWR for survey questions
  const { mutate: mutateSurvey } = useSWR<SurveyQuestion[]>(
    classId ? `/api/survey/${classId}` : null,
    surveyFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      onSuccess: (data: SurveyQuestion[]) => {
        if (data?.length) setSurveyQuestions(data);
      }
    }
  );

  // Use SWR for survey responses (cached and fast)
  const { data: surveyResponses = [], isLoading: loadingResponses, mutate: mutateResponses } = useSWR<SurveyResponse[]>(
    classId ? `/api/survey/response/${classId}` : null,
    surveyResponsesFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  // Use SWR for pathways (cached and fast)
  const { data: pathways = [], isLoading: loadingPathways, mutate: mutatePathways } = useSWR<PathwayData[]>(
    classId ? `/api/pathway/professor/${classId}` : null,
    pathwaysFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
    }
  );

  // Refresh pathways after updates (uses SWR mutate)
  const refreshPathways = useCallback(async () => {
    await mutatePathways();
  }, [mutatePathways]);

  const handleSaveSurvey = async () => {
    const res = await fetch("/api/survey/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        questions: surveyQuestions,
      }),
    })

    if (res.ok) {
      toast("Survey saved", {
        description: "Your survey has been saved successfully.",
      })
      setIsSaveConfirmOpen(false)
      setIsSurveyBuilderOpen(false)
      // Revalidate survey and responses after saving
      await mutateSurvey()
      await mutateResponses()
    } else {
      toast("Error", {
        description: "Failed to save survey. Try again."
      })
    }
  }

  const handleApplyTemplate = async (templateQuestions: SurveyQuestion[]) => {
    try {
      // Merge template questions with existing questions
      const mergedQuestions = [...surveyQuestions, ...templateQuestions];
      
      // Save to database
      const response = await fetch('/api/survey/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId,
          questions: mergedQuestions,
        }),
      });

      if (response.ok) {
        // Update local state only after successful save
        setSurveyQuestions(mergedQuestions);
        setIsTemplateDialogOpen(false);
        
        toast("Template applied and saved", {
          description: `${templateQuestions.length} questions added to your survey.`
        });
      } else {
        throw new Error('Failed to save survey');
      }
    } catch (error) {
      console.error('Error applying template:', error);
      toast("Error", {
        description: "Failed to save template. Please try again."
      });
    }
  }


  const handleGeneratePaths = async () => {
    const res = await fetch("/api/pathway/generate/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId }),
    });
    if (res.ok) {
      toast("Learning paths generated", {
        description: "Learning paths are being generated for students with pending surveys.",
      });
    } else {
      toast("Error", {
        description: "Failed to generate learning paths. Try again.",
      });
    }
    setIsGenerateDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Survey & Learning Path</h2>
        <p className="text-muted-foreground">Create surveys and generate personalized learning paths.</p>
      </div>

      <Card className="hover:shadow-none hover:translate-y-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Survey Management</CardTitle>
            <CardDescription>Create and manage student surveys.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsTemplateDialogOpen(true)}
              className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Template
            </Button>
            <Button onClick={() => setIsSurveyBuilderOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Create/Edit Survey
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              {loadingResponses ? (
                <>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="hidden md:table-cell">Completed At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              ) : (
                <>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="hidden md:table-cell">Completed At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveyResponses.map((response: SurveyResponse) => (
                      <TableRow key={response.studentId}>
                        <TableCell className="font-medium">{response.name}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {new Date(response.submittedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={response.answers.length > 0 ? "default" : "secondary"}>
                            {response.answers.length > 0 ? "Processed" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedStudentResponse(response);
                              setIsSurveyViewOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
      <StudentSurveyDialog
        open={isSurveyViewOpen}
        onClose={() => setIsSurveyViewOpen(false)}
        studentName={selectedStudentResponse?.name}
        completedAt={selectedStudentResponse?.submittedAt}
        answers={selectedStudentResponse?.answers}
      />

      <SurveyTemplateDialog
        open={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        onApplyTemplate={handleApplyTemplate}
        classId={classId}
      />


      <Card className="hover:shadow-none hover:translate-y-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Learning Paths</CardTitle>
            <CardDescription>AI-generated personalized learning paths.</CardDescription>
          </div>
          <Button onClick={() => setIsGenerateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generate Learning Paths
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Generated At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPathways ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                ) : pathways.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No pathways generated yet. Click &quot;Generate Learning Paths&quot; to create them.
                    </TableCell>
                  </TableRow>
                ) : (
                  pathways.map((pathway: PathwayData) => (
                    <TableRow key={pathway.id}>
                      <TableCell className="font-medium">{pathway.studentName}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {new Date(pathway.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            pathway.status === "approved" 
                              ? "default" 
                              : pathway.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {pathway.status === "approved" 
                            ? "Approved" 
                            : pathway.status === "rejected"
                            ? "Rejected"
                            : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPath(pathway)
                                setIsPreviewDialogOpen(true)
                              }}
                            >
                              Preview
                            </DropdownMenuItem>
                            {pathway.status === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={async () => {
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
                                        refreshPathways();
                                      }
                                    } catch {
                                      toast("Error", { description: "Failed to approve pathway." });
                                    }
                                  }}
                                >
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
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
                                        refreshPathways();
                                      }
                                    } catch {
                                      toast("Error", { description: "Failed to reject pathway." });
                                    }
                                  }}
                                >
                                  Reject
                                </DropdownMenuItem>
                              </>
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


      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Learning Paths</DialogTitle>
            <DialogDescription>
              Generate personalized learning paths for students with completed surveys.
            </DialogDescription>
          </DialogHeader>
          <p>
            This will generate learning paths for 2 students with pending survey responses. The AI will analyze their
            responses and create customized learning paths.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGeneratePaths}>Generate Paths</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSurveyBuilderOpen} onOpenChange={setIsSurveyBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Survey Builder for Advanced Physics 101</DialogTitle>
            <DialogDescription>Create and manage survey questions for your students.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Questions</h3>
              <Button
                onClick={() => {
                  const newQuestion = {
                    id: Date.now().toString(), // Changed to string to match SurveyQuestion type
                    text: "",
                    type: "short-answer",
                    options: [],
                  }
                  setSurveyQuestions([...surveyQuestions, newQuestion])
                }}
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </div>

            {surveyQuestions.map((question, index) => (
              <Card key={question.id} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`question-${question.id}`}>Question {index + 1}</Label>
                        <Textarea
                          id={`question-${question.id}`}
                          value={question.text}
                          onChange={(e) => {
                            const updated = surveyQuestions.map((q) =>
                              q.id === question.id ? { ...q, text: e.target.value } : q,
                            )
                            setSurveyQuestions(updated)
                          }}
                          placeholder="Enter your question here..."
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Question Type</Label>
                        <select
                          value={question.type}
                          onChange={(e) => {
                            const updated = surveyQuestions.map((q) =>
                              q.id === question.id
                                ? {
                                    ...q,
                                    type: e.target.value,
                                    options:
                                      e.target.value === "multiple-choice"
                                        ? (q.options ?? []).length > 0
                                          ? q.options ?? []
                                          : [""]
                                        : [],
                                  }
                                : q,
                            )
                            setSurveyQuestions(updated)
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="short-answer">Short Answer</option>
                          <option value="multiple-choice">Multiple Choice</option>
                        </select>
                      </div>

                      {question.type === "multiple-choice" && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Options</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const updated = surveyQuestions.map((q) =>
                                  q.id === question.id
                                    ? {
                                        ...q,
                                        options: [...(q.options ?? []), ""],
                                      }
                                    : q,
                                )
                                setSurveyQuestions(updated)
                              }}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Add Option
                            </Button>
                          </div>
                          {(question.options ?? []).map((option: string, optionIndex: number) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const updated = surveyQuestions.map((q) =>
                                    q.id === question.id
                                      ? {
                                          ...q,
                                          options: (q.options ?? []).map((opt: string, idx: number) =>
                                            idx === optionIndex ? e.target.value : opt,
                                          ),
                                        }
                                      : q,
                                  )
                                  setSurveyQuestions(updated)
                                }}
                                placeholder={`Option ${optionIndex + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const updated = surveyQuestions.map((q) =>
                                    q.id === question.id
                                      ? {
                                          ...q,
                                          options: (q.options ?? []).filter((_: string, idx: number) => idx !== optionIndex),
                                        }
                                      : q,
                                  )
                                  setSurveyQuestions(updated)
                                }}
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSurveyQuestions(surveyQuestions.filter((q) => q.id !== question.id))
                      }}
                    >
                      Delete Question
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {surveyQuestions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No questions added yet. Click &quot;Add Question&quot; to get started.
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsSurveyBuilderOpen(false)}>
              Cancel
            </Button>
            <Button onClick= {handleSaveSurvey}>Save Survey</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSaveConfirmOpen} onOpenChange={setIsSaveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Survey</DialogTitle>
            <DialogDescription>
              Are you sure you want to save this survey? This will update the survey for all students in the class.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  const response = await fetch('/api/survey/save', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      classId,
                      questions: surveyQuestions,
                    }),
                  });

                  if (response.ok) {
                    toast("Survey saved", {
                      description: "Your survey has been saved successfully.",
                    });
                    setIsSaveConfirmOpen(false);
                    setIsSurveyBuilderOpen(false);
                  } else {
                    throw new Error('Failed to save survey');
                  }
                } catch (error) {
                  console.error('Error saving survey:', error);
                  toast("Error", {
                    description: "Failed to save survey. Please try again.",
                  });
                }
              }}
            >
              Save Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProfessorPathwayPreviewDialog
        key={selectedPath?.id || 'dialog'}
        open={isPreviewDialogOpen}
        onClose={() => setIsPreviewDialogOpen(false)}
        pathway={selectedPath}
        classId={classId}
        onPathwayUpdate={refreshPathways}
      />
    </div>
  )
}
