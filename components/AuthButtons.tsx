'use client';

import { signIn, signOut, useSession } from 'next-auth/react';

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;

  return (
    <div className="flex items-center gap-4">
      {session ? (
        <>
          <p className="text-sm">Signed in as <strong>{session.user?.email}</strong></p>
          <button 
            onClick={() => signOut()} 
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded"
          >
            Sign Out
          </button>
        </>
      ) : (
        <button 
          onClick={() => signIn('google')} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded"
        >
          Sign In with Google
        </button>
      )}
    </div>
  );
}