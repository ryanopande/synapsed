"use client"

import type * as React from "react"
import Link from "next/link"
import { ArrowLeft, GitFork, FileText, LayoutDashboard, LineChart, Settings, Users } from "lucide-react"
import Sidebar, { SidebarItem } from "@/components/teacher/SideBar"
import TopNav from "@/components/teacher/TopNav"

interface TeacherDashboardProps {
  children: React.ReactNode
  activeSection: string
  setActiveSection: (section: string) => void
}

export function TeacherDashboard({ children, activeSection, setActiveSection }: TeacherDashboardProps) {
  const classMenuItems: SidebarItem[] = [
    { id: "class-info", name: "Settings", icon: Settings },
    { id: "student-management", name: "Students", icon: Users },
    { id: "content-management", name: "Files & Materials", icon: FileText },
    { id: "survey-learning-path", name: "Learning Paths", icon: GitFork },
    { id: "quizzes-assessments", name: "Assessments", icon: LayoutDashboard },
    { id: "analytics", name: "Analytics", icon: LineChart },
  ]

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar items={classMenuItems} activeId={activeSection} onSelect={setActiveSection} />
        <div className="flex-1 flex flex-col">
          <TopNav />
          <div className="px-4 md:px-6">
            <div className="flex items-center gap-2 mb-4">
              <Link href="/teacher/dashboard" className="inline-flex items-center gap-2 btn-secondary-emerald rounded-full px-3 py-1.5">
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Back to Dashboard</span>
              </Link>
            </div>
          </div>
          <main className="p-4 md:p-6 overflow-y-auto">
            <div className="glass rounded-2xl p-4 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
