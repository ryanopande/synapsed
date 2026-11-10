"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type QuizNotification = {
  id: string;
  title: string;
  classId: string;
  className: string;
  totalQuestions: number;
};

type QuizNotificationsProps = {
  studentId: string;
};

export function QuizNotifications({ studentId }: QuizNotificationsProps) {
  const [notifications, setNotifications] = useState<QuizNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await fetch(`/api/student/quizzes/notifications?studentId=${studentId}`);
        if (!response.ok) {
          throw new Error('Failed to load notifications');
        }
        const data = await response.json();
        setNotifications(data.notifications || []);
      } catch (error) {
        console.error('Error loading quiz notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (studentId) {
      loadNotifications();
    }
  }, [studentId]);

  const unreadCount = notifications.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Quiz notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quiz Notifications</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-slate-500">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No new quizzes available
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={`/class/${notification.classId}/quiz/${notification.id}`}
                    onClick={() => setIsOpen(false)}
                    className="block border-b last:border-b-0 hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {notification.className}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {notification.totalQuestions} questions
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}

