'use client';

import React, { useState } from 'react';
import { CalendarEvent } from '@/lib/db';
import styles from '@/styles/components/ConflictModal.module.css';
import { X, Calendar, AlertTriangle, ArrowRight, ShieldAlert, Check, CheckCircle2 } from 'lucide-react';

interface ConflictItem {
  newEvent: Omit<CalendarEvent, 'id'> | CalendarEvent;
  conflicting: CalendarEvent[];
}

interface ConflictModalProps {
  isOpen: boolean;
  conflicts: ConflictItem[];
  onResolve: (resolutions: {
    toAdd: Omit<CalendarEvent, 'id'>[];
    toDelete: string[];
  }) => void;
  onCancel: () => void;
}

export default function ConflictModal({
  isOpen,
  conflicts,
  onResolve,
  onCancel
}: ConflictModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Track decisions: 'keep_new' or 'keep_existing' or 'keep_both' for each conflict item
  const [decisions, setDecisions] = useState<Record<number, 'keep_new' | 'keep_existing' | 'keep_both'>>({});

  if (!isOpen || conflicts.length === 0) return null;

  const currentConflict = conflicts[currentIndex];
  const totalConflicts = conflicts.length;

  const handleDecision = (decision: 'keep_new' | 'keep_existing' | 'keep_both') => {
    setDecisions(prev => ({ ...prev, [currentIndex]: decision }));
    
    if (currentIndex < totalConflicts - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // All decisions made! Compile results and trigger callback
      const toAdd: Omit<CalendarEvent, 'id'>[] = [];
      const toDelete: string[] = [];

      conflicts.forEach((item, idx) => {
        const choice = { ...decisions, [currentIndex]: decision }[idx]; // Include last decision
        
        if (choice === 'keep_new') {
          toAdd.push(item.newEvent);
          // Delete all existing events that conflict with this new event
          item.conflicting.forEach(c => {
            if (!toDelete.includes(c.id)) {
              toDelete.push(c.id);
            }
          });
        } else if (choice === 'keep_existing') {
          // Discard new event, do nothing (keep existing)
        } else if (choice === 'keep_both') {
          toAdd.push(item.newEvent);
          // Keep existing, so don't add to toDelete
        }
      });

      onResolve({ toAdd, toDelete });
      // Reset state for next time
      setCurrentIndex(0);
      setDecisions({});
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const getBadgeClass = (type: string) => {
    switch (type) {
      case 'class': return 'badge-class';
      case 'exam': return 'badge-exam';
      case 'assignment': return 'badge-assignment';
      case 'study_session': return 'badge-study';
      default: return 'badge-other';
    }
  };

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle className={styles.warningIcon} size={24} />
            <h2 className={styles.title}>Schedule Conflict Detected</h2>
          </div>
          <button className={styles.closeBtn} onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${((currentIndex + 1) / totalConflicts) * 100}%` }}
          />
          <span className={styles.progressText}>
            Resolving Conflict {currentIndex + 1} of {totalConflicts}
          </span>
        </div>

        <div className={styles.content}>
          <p className={styles.subtitle}>
            The following events overlap. Since they take place at the same time, please decide which one has more priority.
          </p>

          <div className={styles.comparisonGrid}>
            {/* New Proposed Event */}
            <div className={`${styles.eventCard} ${styles.newCard}`}>
              <div className={styles.cardHeader}>
                <span className={styles.proposedLabel}>New Proposed Event</span>
                <span className={`badge ${getBadgeClass(currentConflict.newEvent.type)}`}>
                  {currentConflict.newEvent.type}
                </span>
              </div>
              <h3 className={styles.eventTitle}>{currentConflict.newEvent.title}</h3>
              <div className={styles.eventDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Date:</span>
                  <span>{formatDate(currentConflict.newEvent.start_time)}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Time:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {formatTime(currentConflict.newEvent.start_time)} - {formatTime(currentConflict.newEvent.end_time)}
                  </span>
                </div>
                {currentConflict.newEvent.course && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Course:</span>
                    <span>{currentConflict.newEvent.course}</span>
                  </div>
                )}
                {currentConflict.newEvent.description && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Details:</span>
                    <span className={styles.descText}>{currentConflict.newEvent.description}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.vsDivider}>VS</div>

            {/* Existing Conflicting Event(s) */}
            <div className={`${styles.eventCard} ${styles.existingCard}`}>
              <div className={styles.cardHeader}>
                <span className={styles.existingLabel}>Existing Calendar Event</span>
                <span className={`badge ${getBadgeClass(currentConflict.conflicting[0].type)}`}>
                  {currentConflict.conflicting[0].type}
                </span>
              </div>
              <h3 className={styles.eventTitle}>{currentConflict.conflicting[0].title}</h3>
              <div className={styles.eventDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Date:</span>
                  <span>{formatDate(currentConflict.conflicting[0].start_time)}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Time:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>
                    {formatTime(currentConflict.conflicting[0].start_time)} - {formatTime(currentConflict.conflicting[0].end_time)}
                  </span>
                </div>
                {currentConflict.conflicting[0].course && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Course:</span>
                    <span>{currentConflict.conflicting[0].course}</span>
                  </div>
                )}
                {currentConflict.conflicting[0].description && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Details:</span>
                    <span className={styles.descText}>{currentConflict.conflicting[0].description}</span>
                  </div>
                )}
              </div>
              
              {currentConflict.conflicting.length > 1 && (
                <div className={styles.extraConflictsBadge}>
                  + {currentConflict.conflicting.length - 1} other conflicting event(s)
                </div>
              )}
            </div>
          </div>

          <div className={styles.decisionSection}>
            <span className={styles.decisionTitle}>Select Resolution Option:</span>
            
            <div className={styles.decisionButtons}>
              {/* Option A: Keep New Event */}
              <button 
                onClick={() => handleDecision('keep_new')}
                className={`${styles.decisionBtn} ${styles.btnKeepNew}`}
              >
                <div className={styles.btnTitle}>
                  <CheckCircle2 size={16} /> Keep Proposed Event
                </div>
                <div className={styles.btnDesc}>
                  Locks in <strong>"{currentConflict.newEvent.title}"</strong> and deletes the overlapping existing event.
                </div>
              </button>

              {/* Option B: Keep Existing Event */}
              <button 
                onClick={() => handleDecision('keep_existing')}
                className={`${styles.decisionBtn} ${styles.btnKeepExisting}`}
              >
                <div className={styles.btnTitle}>
                  <CheckCircle2 size={16} /> Keep Existing Event
                </div>
                <div className={styles.btnDesc}>
                  Discards the new event and preserves <strong>"{currentConflict.conflicting[0].title}"</strong>.
                </div>
              </button>
            </div>
            
            {/* Allow both as secondary option */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              <button 
                onClick={() => handleDecision('keep_both')}
                className={styles.keepBothLink}
              >
                Keep both events anyway (allow overlap)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
