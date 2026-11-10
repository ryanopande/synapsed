"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

export default function ClassEntryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { classId } = useParams();

  useEffect(() => {
    const checkSurveyStatus = async () => {
      if (!session?.user?.id || !classId) return;

      const res = await fetch(`/api/survey/submit?studentId=${session.user.id}&classId=${classId}`);
      const data = await res.json();

      if (data.submitted) {
        router.push(`/class/${classId}/pathway`);
      } else {
        router.push(`/class/${classId}/survey`);
      }
    };

    checkSurveyStatus();
  }, [session?.user?.id, classId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl animate-pulse">
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
