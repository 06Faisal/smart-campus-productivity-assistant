'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from './AppContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import styles from '@/styles/components/Sidebar.module.css';
import { 
  LayoutDashboard, 
  Calendar, 
  BookOpen, 
  Brain, 
  CheckSquare, 
  Settings,
  GraduationCap,
  Sun,
  Moon
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { setShowSettings, theme, toggleTheme } = useApp();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Lectures', path: '/lectures', icon: BookOpen },
    { name: 'Study Planner', path: '/planner', icon: Brain },
    { name: 'Tasks & Timer', path: '/tasks', icon: CheckSquare },
  ];

  return (
    <aside className={styles.sidebar}>
      <div>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <GraduationCap size={24} />
          </div>
          <div>
            <h1 className={styles.brandName}>Smart Campus</h1>
            <span className={styles.subtitle}>Productivity Hub</span>
          </div>
        </div>

        <nav className={styles.navSection}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link 
                key={item.path} 
                href={item.path} 
                className={`${styles.navLink} ${isActive ? styles.activeNavLink : ''}`}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.footerSection}>
        <div className={styles.footerActions}>
          <button 
            onClick={toggleTheme}
            className={styles.themeToggle}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <button 
            onClick={() => setShowSettings(true)} 
            className={styles.settingsBtn}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>

        <div className={styles.statusIndicator}>
          <span className={`${styles.statusDot} ${isSupabaseConfigured ? styles.statusDotOnline : styles.statusDotOffline}`} />
          <span>{isSupabaseConfigured ? 'Supabase Sync Active' : 'Offline Mode (Local)'}</span>
        </div>
      </div>
    </aside>
  );
}
