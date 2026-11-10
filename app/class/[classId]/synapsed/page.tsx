"use client";

import AIAssistant from '@/components/AIAssistant';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

const SynapsedFlow = dynamic(() => import('@/components/Synapses/Pathway/PathwayDisplay'), {
  ssr: false,
  loading: () => null,
});

export default function SynapsedPathwayPage() {
  const { data: session } = useSession();
  const params = useParams();
  const classId = Array.isArray(params.classId) ? params.classId[0] : params.classId;
  const [title, setTitle] = useState<string>("Synapsed Learning Pathways");
  const [prof, setProf] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id || !classId) return;
      try {
        const res = await fetch(`/api/student/classes?enrollmentId=${session.user.id}`);
        const data = await res.json();
        const cls = (data || []).find((c: { id: string }) => c.id === classId);
        if (cls) {
          setTitle(cls.title || "Class");
          setProf(cls.professor?.name || null);
        }
      } catch {}
    };
    load();
  }, [session?.user?.id, classId]);
  return (
    <main className="min-h-screen">
      <div className="px-4 py-6 max-w-screen-xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/student/dashboard" className="inline-flex items-center gap-2 btn-secondary-emerald rounded-full px-4 py-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </Link>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-800 ml-2">
                {title}
                {prof && <span className="text-base text-slate-500 ml-3">· {prof}</span>}
              </h1>
            </div>
          </div>
          <p className="text-slate-600 mt-2">
            Generate personalized learning paths with AI. Type a topic and watch as Synapsed creates an interactive journey.
          </p>
        </header>
        
        <div className="glass rounded-2xl overflow-hidden shadow-xl min-h-[calc(100vh-180px)]">
          <SynapsedFlow />
        </div>
      </div>
      <AIAssistant/>
    </main>
  );
}
