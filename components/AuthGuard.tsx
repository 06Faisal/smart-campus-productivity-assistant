'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, UserProfile } from '@/lib/auth';
import { useApp } from './AppContext';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { addNotification } = useApp();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function checkSession() {
      // Allow the login page to load without auth checking to prevent loops
      if (pathname === '/login') {
        setChecking(false);
        return;
      }

      try {
        const currentUser = await auth.getCurrentUser();
        if (!currentUser) {
          setUser(null);
          router.replace('/login');
        } else {
          setUser(currentUser);
        }
      } catch (err) {
        console.error('Session validation error:', err);
        router.replace('/login');
      } finally {
        setChecking(false);
      }
    }
    checkSession();
  }, [pathname, router]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: '#050609',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          zIndex: 9999
        }}
      >
        <span 
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '50%',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin 1s linear infinite'
          }}
        />
        <span 
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 600
          }}
        >
          Validating Security Session...
        </span>
      </div>
    );
  }

  return user ? <>{children}</> : null;
}
