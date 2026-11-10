'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/student/StudentSideBar";
import StudentDashboard from "@/components/student/StudentDashboard";

export default function StudentPageClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen p-6">
        <div className="w-full max-w-md animate-pulse">
          <div className="h-6 w-48 bg-slate-200 rounded mb-4 mx-auto" />
          <div className="space-y-3">
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-11/12 bg-slate-100 rounded" />
            <div className="h-3 w-10/12 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    // Add a small delay to prevent immediate redirect during race condition
    setTimeout(() => {
      router.replace("/sign-in");
    }, 100);
    return (
      <div className="flex items-center justify-center h-screen p-6">
        <div className="w-full max-w-md animate-pulse">
          <div className="h-6 w-56 bg-slate-200 rounded mb-4 mx-auto" />
          <div className="space-y-3">
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-11/12 bg-slate-100 rounded" />
            <div className="h-3 w-10/12 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      
      <div className="flex-1">
        <StudentDashboard user={session.user} />
      </div>
    </div>
  );
}

