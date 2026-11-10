"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { signOutToSignIn, useSession } from "@/lib/auth/client";
import { LogOut } from "lucide-react";
import Sidebar from "@/components/teacher/layout/TeacherSidebar";
import TopNav from "@/components/teacher/layout/TopNav";
import ClassInfoSettings from "@/components/teacher/class/ClassInfoSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProfessorClass {
  id: string;
  title: string;
  enrollments?: unknown[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load classes");
  return res.json();
};

function AccountCard() {
  const { data: session } = useSession();
  const user = session?.user as
    | { name?: string | null; email?: string | null; image?: string | null; role?: string }
    | undefined;
  const name = user?.name || "Professor";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            {user?.image && <AvatarImage src={user.image} alt={name} />}
            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{name}</p>
            <p className="text-sm text-gray-600 truncate">{user?.email}</p>
            {user?.role && (
              <p className="text-xs text-gray-500 mt-0.5 capitalize">{user.role.toLowerCase()}</p>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Your name, email and photo come from your Google account. Change them in Google to update them here.
        </p>
        <Button variant="outline" onClick={() => signOutToSignIn()} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}

function ClassSettingsCard() {
  const { data: session } = useSession();
  const professorId = session?.user?.id;
  const { data: classes, error, isLoading } = useSWR<ProfessorClass[]>(
    professorId ? `/api/professor/classes?professorId=${professorId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const classId = selectedId ?? classes?.[0]?.id ?? null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Class settings</CardTitle>
        {classes && classes.length > 1 && (
          <Select value={classId ?? undefined} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        {isLoading || !professorId ? (
          <p className="text-sm text-gray-500">Loading classes...</p>
        ) : error ? (
          <p className="text-sm text-red-600">Could not load your classes. Please refresh the page.</p>
        ) : !classId ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">You haven&apos;t created any classes yet.</p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Link href="/teacher/classes">Go to Classes</Link>
            </Button>
          </div>
        ) : (
          // key resets the form state when switching classes
          <ClassInfoSettings key={classId} classId={classId} />
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopNav />
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="space-y-6 max-w-3xl">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600 mt-1">Manage your account and class settings</p>
              </div>
              <AccountCard />
              <ClassSettingsCard />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
