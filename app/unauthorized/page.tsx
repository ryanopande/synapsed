'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Shield, GraduationCap, User } from 'lucide-react';
import { Role } from '@prisma/client';

type UserWithRole = {
  id: string;
  email: string;
  name?: string;
  role?: Role;
};

export default function UnauthorizedPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleProfessorClick = () => {
    router.push('/teacher/dashboard');
  };

  const handleStudentClick = () => {
    router.push('/student/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-8">
            You don&apos;t have access to this page. Please navigate to your appropriate dashboard.
          </p>

          <div className="space-y-4">
            <Button 
              onClick={handleProfessorClick}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
            >
              <GraduationCap className="w-5 h-5 mr-2" />
              Professor Dashboard
            </Button>
            
            <Button 
              onClick={handleStudentClick}
              variant="outline"
              className="w-full border-gray-300 hover:bg-gray-50 py-3"
            >
              <User className="w-5 h-5 mr-2" />
              Student Dashboard
            </Button>
          </div>

          {session?.user && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Signed in as: <span className="font-medium">{session.user.email}</span>
              </p>
              {(session.user as UserWithRole).role && (
                <p className="text-sm text-gray-600 mt-1">
                  Role: <span className="font-medium capitalize">{(session.user as UserWithRole).role?.toLowerCase()}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
