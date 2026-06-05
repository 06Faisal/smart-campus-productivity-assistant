'use client';

import React from 'react';
import { useApp } from './AppContext';
import styles from '@/styles/components/NotificationToast.module.css';
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

export default function NotificationToast() {
  const { notifications, clearNotification } = useApp();

  if (notifications.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className={styles.iconSuccess} size={20} />;
      case 'warning':
        return <AlertTriangle className={styles.iconWarning} size={20} />;
      case 'error':
        return <XCircle className={styles.iconError} size={20} />;
      default:
        return <Info className={styles.iconInfo} size={20} />;
    }
  };

  const getToastClass = (type: string) => {
    switch (type) {
      case 'success':
        return styles.toastSuccess;
      case 'warning':
        return styles.toastWarning;
      case 'error':
        return styles.toastError;
      default:
        return styles.toastInfo;
    }
  };

  return (
    <div className={styles.container}>
      {notifications.map((notif) => (
        <div 
          key={notif.id} 
          className={`${styles.toast} ${getToastClass(notif.type)}`}
        >
          {getIcon(notif.type)}
          <div className={styles.message}>{notif.message}</div>
          <button 
            onClick={() => clearNotification(notif.id)} 
            className={styles.closeBtn}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
