"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Sparkles, Edit3, CheckCircle, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

type SurveyQuestion = { id: string; text: string; type: string; options?: string[] };

interface SurveyTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (questions: SurveyQuestion[]) => void;
  classId: string;
  courseName?: string;
}

interface ClassInfo {
  title: string;
  description: string | null;
}

interface SyllabusStatus {
  hasSyllabus: boolean;
  confidence: number;
  materialCount: number;
}

export default function SurveyTemplateDialog({ 
  open, 
  onClose, 
  onApplyTemplate, 
  classId
}: SurveyTemplateDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateQuestions, setTemplateQuestions] = useState<SurveyQuestion[]>([]);
  const [customCourseName, setCustomCourseName] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customLevel, setCustomLevel] = useState("undergraduate");
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [syllabusStatus, setSyllabusStatus] = useState<SyllabusStatus | null>(null);

  // Load class information and syllabus status
  useEffect(() => {
    if (!open || !classId) return;

    const loadClassInfo = async () => {
      try {
        // Fetch class information
        const classResponse = await fetch(`/api/class/${classId}`);
        if (classResponse.ok) {
          const classData = await classResponse.json();
          setClassInfo({
            title: classData.title,
            description: classData.description
          });
          setCustomCourseName(classData.title);
        }

        // Fetch syllabus status
        const syllabusResponse = await fetch(`/api/syllabus/content?classId=${classId}`);
        if (syllabusResponse.ok) {
          const syllabusData = await syllabusResponse.json();
          setSyllabusStatus({
            hasSyllabus: syllabusData.hasSyllabus,
            confidence: syllabusData.content?.averageConfidence || 0,
            materialCount: syllabusData.content?.materialCount || 0
          });
        }
      } catch (error) {
        console.error("Error loading class info:", error);
      }
    };

    loadClassInfo();
  }, [open, classId]);

  const handleGenerateTemplate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/survey/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          subject: customSubject || undefined,
          level: customLevel
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate template");
      }

      const data = await response.json();
      setTemplateQuestions(data.questions || []);
      toast("Template generated successfully!", {
        description: `Generated ${data.questions?.length || 0} questions for your survey.`
      });
    } catch (error) {
      console.error("Template generation error:", error);
      toast("Error", {
        description: "Failed to generate template. Please try again."
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditQuestion = (questionId: string) => {
    setEditingQuestion(questionId);
  };

  const handleSaveEdit = (questionId: string, field: string, value: string) => {
    setTemplateQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { ...q, [field]: value }
          : q
      )
    );
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (questionId: string) => {
    setTemplateQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  const handleAddOption = (questionId: string) => {
    setTemplateQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { ...q, options: [...(q.options || []), ""] }
          : q
      )
    );
  };

  const handleUpdateOption = (questionId: string, optionIndex: number, value: string) => {
    setTemplateQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              options: (q.options || []).map((opt, idx) => 
                idx === optionIndex ? value : opt
              )
            }
          : q
      )
    );
  };

  const handleRemoveOption = (questionId: string, optionIndex: number) => {
    setTemplateQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              options: (q.options || []).filter((_, idx) => idx !== optionIndex)
            }
          : q
      )
    );
  };

  const handleApplyTemplate = () => {
    if (templateQuestions.length === 0) {
      toast("No questions to apply", {
        description: "Please generate a template first."
      });
      return;
    }
    
    onApplyTemplate(templateQuestions);
    onClose();
    toast("Template applied successfully!", {
      description: `${templateQuestions.length} questions added to your survey.`
    });
  };

  const getQuestionCategory = (question: SurveyQuestion) => {
    const text = question.text.toLowerCase();
    if (text.includes("goal") || text.includes("motivat")) return "Goals & Motivation";
    if (text.includes("prereq") || text.includes("previous") || text.includes("experience")) return "Prerequisites";
    if (text.includes("learn") && text.includes("style")) return "Learning Style";
    if (text.includes("list") || text.includes("remember")) return "Remember";
    if (text.includes("explain") || text.includes("understand")) return "Understand";
    if (text.includes("apply") || text.includes("use")) return "Apply";
    if (text.includes("analyze") || text.includes("compare")) return "Analyze";
    if (text.includes("evaluate") || text.includes("judge")) return "Evaluate";
    if (text.includes("create") || text.includes("design")) return "Create";
    return "General";
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      "Goals & Motivation": "bg-blue-100 text-blue-800",
      "Prerequisites": "bg-green-100 text-green-800", 
      "Learning Style": "bg-purple-100 text-purple-800",
      "Remember": "bg-yellow-100 text-yellow-800",
      "Understand": "bg-orange-100 text-orange-800",
      "Apply": "bg-red-100 text-red-800",
      "Analyze": "bg-pink-100 text-pink-800",
      "Evaluate": "bg-indigo-100 text-indigo-800",
      "Create": "bg-teal-100 text-teal-800",
      "General": "bg-gray-100 text-gray-800"
    };
    return colors[category] || colors["General"];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Survey Template Generator
          </DialogTitle>
          <DialogDescription>
            Generate a comprehensive survey template based on Bloom&apos;s taxonomy and educational best practices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Syllabus Status */}
          {syllabusStatus && (
            <Card className={syllabusStatus.hasSyllabus ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {syllabusStatus.hasSyllabus ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  Syllabus Data Status
                </CardTitle>
                <CardDescription>
                  {syllabusStatus.hasSyllabus 
                    ? `Syllabus data available (${syllabusStatus.materialCount} materials, ${syllabusStatus.confidence}% confidence)`
                    : "No syllabus data found. Template will use generic questions."
                  }
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Template Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Configuration</CardTitle>
              <CardDescription>
                {classInfo ? `Generate template for: ${classInfo.title}` : "Customize the template generation for your specific course."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course-name">Course Name</Label>
                  <Input
                    id="course-name"
                    value={classInfo?.title || customCourseName}
                    disabled={true}
                    className="bg-gray-50"
                    placeholder="Loading course information..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Area (Optional)</Label>
                  <Input
                    id="subject"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="e.g., Computer Science, Mathematics"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Academic Level</Label>
                  <select
                    id="level"
                    value={customLevel}
                    onChange={(e) => setCustomLevel(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="undergraduate">Undergraduate</option>
                    <option value="graduate">Graduate</option>
                    <option value="high-school">High School</option>
                    <option value="professional">Professional Development</option>
                  </select>
                </div>
              </div>
              
              <Button 
                onClick={handleGenerateTemplate} 
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Template...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate AI Template
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Questions */}
          {templateQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Questions ({templateQuestions.length})</CardTitle>
                <CardDescription>
                  Review and edit the generated questions before applying to your survey.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {templateQuestions.map((question, index) => {
                  const category = getQuestionCategory(question);
                  const isEditing = editingQuestion === question.id;
                  
                  return (
                    <Card key={question.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge className={getCategoryColor(category)}>
                              {category}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Question {index + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditQuestion(question.id)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteQuestion(question.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Question Text</Label>
                              <Textarea
                                value={question.text}
                                onChange={(e) => handleSaveEdit(question.id, "text", e.target.value)}
                                rows={2}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Question Type</Label>
                              <select
                                value={question.type}
                                onChange={(e) => handleSaveEdit(question.id, "type", e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                                    onClick={() => handleAddOption(question.id)}
                                  >
                                    Add Option
                                  </Button>
                                </div>
                                {(question.options || []).map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex items-center gap-2">
                                    <Input
                                      value={option}
                                      onChange={(e) => handleUpdateOption(question.id, optionIndex, e.target.value)}
                                      placeholder={`Option ${optionIndex + 1}`}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveOption(question.id, optionIndex)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => setEditingQuestion(null)}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingQuestion(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="font-medium">{question.text}</p>
                            {question.type === "multiple-choice" && question.options && question.options.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Options:</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {question.options.map((option, optionIndex) => (
                                    <li key={optionIndex} className="text-sm">
                                      {option}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleApplyTemplate}
            disabled={templateQuestions.length === 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Apply Template ({templateQuestions.length} questions)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
