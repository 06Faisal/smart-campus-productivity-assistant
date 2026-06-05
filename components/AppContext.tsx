'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  time: Date;
}

type ThemeMode = 'dark' | 'light';

interface AppContextType {
  userApiKey: string;
  setUserApiKey: (key: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  notifications: Notification[];
  addNotification: (message: string, type?: Notification['type']) => void;
  clearNotification: (id: string) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userApiKey, setUserApiKeyInternal] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [theme, setTheme] = useState<ThemeMode>('dark');

  // Load preferences from LocalStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('user_gemini_api_key');
    if (storedKey) {
      setUserApiKeyInternal(storedKey);
    }
    const storedTheme = localStorage.getItem('smart_campus_theme') as ThemeMode | null;
    if (storedTheme) {
      setTheme(storedTheme);
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('smart_campus_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const setUserApiKey = (key: string) => {
    setUserApiKeyInternal(key);
    if (key) {
      localStorage.setItem('user_gemini_api_key', key);
    } else {
      localStorage.removeItem('user_gemini_api_key');
    }
  };

  const addNotification = (message: string, type: Notification['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotif: Notification = { id, message, type, time: new Date() };
    setNotifications(prev => [newNotif, ...prev].slice(0, 5));

    setTimeout(() => {
      clearNotification(id);
    }, 5000);
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        userApiKey,
        setUserApiKey,
        showSettings,
        setShowSettings,
        notifications,
        addNotification,
        clearNotification,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
