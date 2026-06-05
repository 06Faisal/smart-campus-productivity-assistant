'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import styles from '@/styles/components/SettingsModal.module.css';
import { X, Key, Database, Cloud } from 'lucide-react';

export default function SettingsModal() {
  const { 
    showSettings, 
    setShowSettings, 
    userApiKey, 
    setUserApiKey,
    addNotification 
  } = useApp();

  const [tempKey, setTempKey] = useState('');

  // Sync temp key with stored state when opened
  useEffect(() => {
    if (showSettings) {
      setTempKey(userApiKey);
    }
  }, [showSettings, userApiKey]);

  if (!showSettings) return null;

  const handleSave = () => {
    setUserApiKey(tempKey);
    addNotification('Settings saved successfully!', 'success');
    setShowSettings(false);
  };

  return (
    <div className={styles.backdrop} onClick={() => setShowSettings(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>System Settings</h2>
          <button className={styles.closeBtn} onClick={() => setShowSettings(false)}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Custom Gemini API Key</label>
            <div className={styles.inputWrapper}>
              <Key size={18} className={styles.inputIcon} />
              <input 
                type="password" 
                value={tempKey} 
                onChange={(e) => setTempKey(e.target.value)} 
                placeholder="AIzaSy..." 
                className={`${styles.input} form-input`}
              />
            </div>
            <p className={styles.helpText}>
              By default, we call API requests using the host server environment key. 
              Enter your own key here to override the server's API key. 
              Get one from the <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className={styles.helpLink}>Google AI Studio</a>.
            </p>
          </div>

          <div className={styles.statusCard}>
            <h3 className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} /> Backend Status
            </h3>
            <div className={styles.statusRow}>
              <span>Database Connection</span>
              <span className={isSupabaseConfigured ? styles.statusVal : styles.statusValBad}>
                {isSupabaseConfigured ? 'Supabase Postgres Cloud' : 'Browser LocalStorage'}
              </span>
            </div>
            <div className={styles.statusRow}>
              <span>Syncing Capabilities</span>
              <span>{isSupabaseConfigured ? 'Real-time Enabled' : 'Disabled (Local only)'}</span>
            </div>
            <div className={styles.statusRow}>
              <span>Host API Key Available</span>
              <span>{process.env.NEXT_PUBLIC_HAS_SERVER_KEY === 'true' || process.env.NODE_ENV === 'development' ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div className={styles.footer}>
            <button className="btn-secondary" onClick={() => setShowSettings(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
