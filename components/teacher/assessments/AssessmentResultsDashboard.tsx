"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentAssessmentList } from "./StudentAssessmentList";
import { ProfessorQuizResults } from "./ProfessorQuizResults";

interface AssessmentResultsDashboardProps {
  classId: string;
}

export function AssessmentResultsDashboard({
  classId,
}: AssessmentResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<"ai-led" | "professor-led">("ai-led");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assessment Results</h1>
          <p className="text-gray-600 mt-1">View student performance on assessments</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ai-led">AI-Led Quiz</TabsTrigger>
          <TabsTrigger value="professor-led">Professor-Led Quiz</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-led" className="mt-6">
          <StudentAssessmentList classId={classId} />
        </TabsContent>

        <TabsContent value="professor-led" className="mt-6">
          <ProfessorQuizResults classId={classId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

