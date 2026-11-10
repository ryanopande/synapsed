'use client';

import { Suspense, useEffect } from 'react';
import { CHOOSE_ROLE_PATH, HOME_BY_ROLE, signInWithGoogle, useSession } from '@/lib/auth/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { FcGoogle } from "react-icons/fc";

import { Button } from '@/components/ui/button';

// Kept across the first-login detour (sign in -> choose role -> sign in again).
const RETURN_KEY = 'synapsed:returnTo';

/** Only same-site paths are allowed, so the parameter can't redirect users to another site. */
function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/sign-in')) return null;
  return value;
}

function readStoredReturnPath(): string | null {
  try {
    return safeReturnPath(sessionStorage.getItem(RETURN_KEY));
  } catch {
    return null;
  }
}

function SignInContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeReturnPath(searchParams.get('callbackUrl'));

  useEffect(() => {
    if (!callbackUrl) return;
    try {
      sessionStorage.setItem(RETURN_KEY, callbackUrl);
    } catch {
      // Storage unavailable; the URL parameter still works for returning users.
    }
  }, [callbackUrl]);

  useEffect(() => {
    //console.log('Auth status:', status);
    //console.log('Session:', session);
    
    if (status === 'authenticated') {
      const role = session?.user?.role;
      //console.log('User role:', role);

      const returnTo = callbackUrl ?? readStoredReturnPath();

      if (!role) {
        //console.log('Redirecting to choose-role');
        router.push(CHOOSE_ROLE_PATH);
      } else if (returnTo) {
        try {
          sessionStorage.removeItem(RETURN_KEY);
        } catch {
          // ignore
        }
        router.push(returnTo);
      } else {
        router.push(HOME_BY_ROLE[role]);
      }
    }
  }, [session, status, router, callbackUrl]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center  px-4">
      <div className="  rounded-3xl p-10 max-w-md w-full">
        <h2 className="text-4xl font-bold text-center text-gray-800 mb-4">Welcome Back</h2>
        <p className="text-center text-gray-500 mb-6">Sign in to your SynapsEd account</p>

        <Button
          onClick={() => signInWithGoogle()}
          className="w-full flex items-center justify-center  space-x-2 py-3"
          variant={'outline'}
        >
          <FcGoogle className="w-5 h-5" />
          <span>Sign in with Google</span>
        </Button>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
