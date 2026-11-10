import Sidebar from "@/components/teacher/SideBar";
import TopNav from "@/components/teacher/TopNav";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { Plus, Upload, Users, BookOpen } from "lucide-react";

export default async function TeacherDashboardPage() {
  const session = await auth();
  const professorId = session?.user?.id;

  let classesCount = 0;
  let studentsCount = 0;
  let materialsCount = 0;
  let recentClasses: { id: string; title: string; createdAt: Date }[] = [];

  if (professorId) {
    classesCount = await prisma.class.count({ where: { professorId } });
    studentsCount = await prisma.classEnrollment.count({
      where: { class: { professorId } },
    });
    materialsCount = await prisma.classMaterial.count({
      where: { class: { professorId } },
    });
    recentClasses = await prisma.class.findMany({
      where: { professorId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, createdAt: true },
    });
  }

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        
        <div className="flex-1 flex flex-col">
          <TopNav />

          <main className="p-4 md:p-6">
            <div className="space-y-5">
              {/* Header */}
              <div className="glass rounded-2xl p-6 glass-outline">
                <h1 className="text-3xl font-bold text-slate-900">Teacher Dashboard</h1>
                <p className="text-slate-600 mt-1">Plan classes, manage students, and share materials.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/teacher/classes" className="btn-primary-emerald rounded-full px-4 py-2 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Manage Classes
                  </Link>
                  <Link href="/upload" className="btn-primary-emerald rounded-full px-4 py-2 flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Upload Material
                  </Link>
                  <Link href="/teacher/classes" className="btn-primary-emerald rounded-full px-4 py-2 flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Create Class
                  </Link>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-soft rounded-2xl p-5 glass-outline">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Classes</span>
                    <BookOpen className="h-5 w-5 text-slate-500" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{classesCount}</p>
                </div>
                <div className="glass-soft rounded-2xl p-5 glass-outline">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Students</span>
                    <Users className="h-5 w-5 text-slate-500" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{studentsCount}</p>
                </div>
                <div className="glass-soft rounded-2xl p-5 glass-outline">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Materials</span>
                    <Upload className="h-5 w-5 text-slate-500" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{materialsCount}</p>
                </div>
                <div className="glass-soft rounded-2xl p-5 glass-outline">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Active Classes</span>
                    <BookOpen className="h-5 w-5 text-slate-500" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{Math.max(classesCount - 0, 0)}</p>
                </div>
              </div>

              {/* Recent classes */}
              <div className="glass rounded-2xl p-6 glass-outline">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Classes</h3>
                  <Link href="/teacher/classes" className="text-sm text-slate-600 hover:text-slate-900">View all</Link>
                </div>
                {recentClasses.length === 0 ? (
                  <p className="text-slate-600">No classes yet. Create your first class to get started.</p>
                ) : (
                  <ul className="divide-y divide-white/50">
                    {recentClasses.map((c) => (
                      <li key={c.id} className="py-3 flex items-center justify-between">
                        <div>
                          <Link href={`/teacher/classes/${c.id}`} className="font-medium text-slate-900 hover:underline">
                            {c.title}
                          </Link>
                          <p className="text-xs text-slate-600">{new Date(c.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Link href={`/teacher/classes/${c.id}`} className="btn-secondary-emerald rounded-full px-3 py-1 text-sm">Open</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

