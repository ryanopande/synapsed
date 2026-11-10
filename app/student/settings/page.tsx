"use client";

import Link from "next/link";
import useSWR from "swr";
import { signOutToSignIn, useSession } from "@/lib/auth/client";
import Sidebar from "@/components/student/StudentSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface EnrolledClass {
  id: string;
  title: string;
  description?: string | null;
  professor?: { name?: string | null } | null;
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
  const name = user?.name || "Student";

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
        <Button
          variant="outline"
          onClick={() => signOutToSignIn()}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}

function ClassesCard() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { data: classes, error, isLoading } = useSWR<EnrolledClass[]>(
    userId ? `/api/student/classes?enrollmentId=${userId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Classes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !userId ? (
          <p className="text-sm text-gray-500">Loading classes...</p>
        ) : error ? (
          <p className="text-sm text-red-600">Could not load your classes. Please refresh the page.</p>
        ) : !classes?.length ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">You are not enrolled in any classes yet.</p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Link href="/student/join">Join a class</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {classes.map((cls) => (
              <li key={cls.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{cls.title}</p>
                  {cls.professor?.name && (
                    <p className="text-sm text-gray-500 truncate">{cls.professor.name}</p>
                  )}
                </div>
                <Link
                  href={`/class/${cls.id}/pathway`}
                  className="text-sm text-emerald-700 hover:text-emerald-800 shrink-0"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function StudentSettingsPage() {
  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="space-y-6 max-w-3xl">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600 mt-1">Manage your account and preferences</p>
              </div>
              <AccountCard />
              <ClassesCard />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
