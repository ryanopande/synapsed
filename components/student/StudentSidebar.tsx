"use client";

import TeacherSidebar, { type SidebarItem } from "@/components/teacher/layout/TeacherSidebar";
import { Home, BookOpen, MessageSquare, Award, Settings } from "lucide-react";
import { useSession } from "@/lib/auth/client";
import { QuizNotifications } from "@/components/student/quizzes/QuizNotifications";

export default function StudentSidebar() {
  const { data: session } = useSession();
  const items: SidebarItem[] = [
    { name: "Dashboard", path: "/student/dashboard", icon: Home },
    { name: "Join a Class", path: "/student/join", icon: BookOpen },
    { name: "Feedback", path: "/student/feedback", icon: MessageSquare },
    { name: "Achievements", path: "/student/achievements", icon: Award },
    { name: "Settings", path: "/student/settings", icon: Settings },
  ];

  return (
    <TeacherSidebar 
      items={items} 
      notificationComponent={session?.user?.id ? (
        <QuizNotifications studentId={session.user.id} />
      ) : undefined}
    />
  );
}


