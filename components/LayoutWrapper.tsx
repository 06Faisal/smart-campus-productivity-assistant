'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import SettingsModal from '@/components/SettingsModal';
import NotificationToast from '@/components/NotificationToast';
import CyberGrid from '@/components/CyberGrid';
import AuthGuard from '@/components/AuthGuard';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <>
      <CyberGrid />
      {isLoginPage ? (
        <AuthGuard>{children}</AuthGuard>
      ) : (
        <AuthGuard>
          <div className="layout-container">
            <Sidebar />
            <main className="main-content animate-fade-in">
              {children}
            </main>
          </div>
          <SettingsModal />
          <NotificationToast />
        </AuthGuard>
      )}
    </>
  );
}
