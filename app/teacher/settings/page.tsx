"use client";

import { Suspense } from "react";
import Sidebar from "@/components/teacher/SideBar";
import TopNav from "@/components/teacher/TopNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SettingsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Settings page coming soon...</p>
        </CardContent>
      </Card>
    </div>
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
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  Loading...
                </div>
              }
            >
              <SettingsContent />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

