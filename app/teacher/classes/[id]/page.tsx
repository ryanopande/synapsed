'use client'
import { StudentManagement } from "@/components/teacher/class/StudentManagement"
import ContentManagement from "@/components/teacher/class/content/ContentManagement"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ClassPageLayout } from "@/components/teacher/class/ClassPageLayout"
import { SurveyManagement } from "@/components/teacher/class/surveys/SurveyManagement"
import { ClassAssessmentsManagement } from "@/components/teacher/class/ClassAssessmentsManagement"
import ClassInfoSettings from "@/components/teacher/class/ClassInfoSettings"
import { ClassAnalytics } from "@/components/teacher/class/ClassAnalytics"

export default function Page() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const classId = params.id as string
  
  // Initialize from URL query param, default to "class-info"
  const tabFromUrl = searchParams.get('tab') || 'class-info'
  const [activeSection, setActiveSection] = useState(tabFromUrl)

  // Sync state with URL on mount and when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab') || 'class-info'
    setActiveSection(tab)
  }, [searchParams])

  // Update URL when section changes
  const handleSectionChange = (section: string) => {
    setActiveSection(section)
    router.push(`/teacher/classes/${classId}?tab=${section}`)
  }

  if (!classId) return null;

  const renderContent = () => {
    switch (activeSection) {
      case "class-info":
        return <ClassInfoSettings classId={classId} />
      case "student-management":
        return <StudentManagement classId={classId} />
      case "content-management":
        return <ContentManagement classId={classId} />
      case "survey-learning-path":
        return <SurveyManagement classId={classId} />
      case "quizzes-assessments":
        return <ClassAssessmentsManagement classId={classId} />
      case "analytics":
        return <ClassAnalytics classId={classId} />
      default:
        return <ClassInfoSettings classId={classId} />
    }
  }

  return (
    <ClassPageLayout activeSection={activeSection} setActiveSection={handleSectionChange}>
      {renderContent()}
    </ClassPageLayout>
  )
}
