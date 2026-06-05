'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, Task } from '@/lib/db';
import { useApp } from '@/components/AppContext';
import styles from '@/styles/components/TasksPage.module.css';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Clock, 
  Target, 
  Flame, 
  Award,
  PlusCircle
} from 'lucide-react';

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export default function TasksPage() {
  const { addNotification } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusedTask, setFocusedTask] = useState<Task | null>(null);

  // Timer configuration
  const [timerMode, setTimerMode] = useState<TimerMode>('focus');
  const [timeRemaining, setTimeRemaining] = useState(25 * 60); // 25 minutes default
  const [timerActive, setTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manual task creation form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('urgent_important');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Mode durations in seconds
  const modeDurations = {
    focus: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  };

  // Load tasks
  const loadTasks = async () => {
    try {
      const fetched = await db.getTasks();
      setTasks(fetched);
      
      // Auto-set first incomplete task as focused if none is selected
      const incomplete = fetched.filter(t => !t.completed);
      if (incomplete.length > 0 && !focusedTask) {
        setFocusedTask(incomplete[0]);
      }
    } catch (err) {
      addNotification('Could not load task list', 'error');
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Timer interval handling
  useEffect(() => {
    if (timerActive) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerActive, timerMode, focusedTask]);

  // Handle pomodoro session complete
  const handleSessionComplete = async () => {
    setTimerActive(false);
    
    // Play sound notification
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.log('Audio notification fallback');
    }

    if (timerMode === 'focus') {
      addNotification('Pomodoro Session Complete! Time for a short break.', 'success');
      
      // Increment pomodoro count for active task
      if (focusedTask) {
        try {
          const updated = await db.updateTask(focusedTask.id, {
            pomodoro_count: (focusedTask.pomodoro_count || 0) + 1
          });
          if (updated) {
            setFocusedTask(updated);
            loadTasks();
          }
        } catch (err) {
          console.error('Error incrementing task pomodoro count:', err);
        }
      }

      // Switch to break
      setTimerMode('shortBreak');
      setTimeRemaining(modeDurations.shortBreak);
    } else {
      addNotification('Break over! Time to focus.', 'info');
      setTimerMode('focus');
      setTimeRemaining(modeDurations.focus);
    }
  };

  // Change timer modes
  const handleModeChange = (mode: TimerMode) => {
    setTimerActive(false);
    setTimerMode(mode);
    setTimeRemaining(modeDurations[mode]);
  };

  // Toggle play/pause
  const toggleTimer = () => {
    setTimerActive(!timerActive);
  };

  // Reset timer
  const resetTimer = () => {
    setTimerActive(false);
    setTimeRemaining(modeDurations[timerMode]);
  };

  // Format countdown string
  const formatTimeStr = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // SVG Progress calculation
  const totalDuration = modeDurations[timerMode];
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - timeRemaining / totalDuration);

  // Add new task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      addNotification('Please enter a task title', 'warning');
      return;
    }

    try {
      const created = await db.addTask({
        title: taskTitle,
        completed: false,
        due_date: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
        priority: taskPriority,
        pomodoro_count: 0
      });

      setTasks(prev => [...prev, created]);
      setTaskTitle('');
      setTaskDueDate('');
      
      // Auto-focus if there is no focused task
      if (!focusedTask) {
        setFocusedTask(created);
      }

      addNotification('Task added to priority matrix!', 'success');
    } catch (err) {
      addNotification('Error adding task', 'error');
    }
  };

  // Toggle task completion
  const handleToggleTask = async (id: string, currentCompleted: boolean) => {
    try {
      const updated = await db.updateTask(id, { completed: !currentCompleted });
      if (updated) {
        setTasks(prev => prev.map(t => t.id === id ? updated : t));
        addNotification(`Task marked as ${!currentCompleted ? 'completed' : 'pending'}!`, 'success');
        
        // If the completed task was focused, auto-select another one
        if (focusedTask?.id === id) {
          if (!currentCompleted) {
            // Task became completed, find next incomplete
            const nextIncomplete = tasks.find(t => t.id !== id && !t.completed);
            setFocusedTask(nextIncomplete || null);
          } else {
            // Task became pending, focus it
            setFocusedTask(updated);
          }
        }
      }
    } catch (err) {
      addNotification('Error updating task', 'error');
    }
  };

  // Delete task
  const handleDeleteTask = async (id: string) => {
    try {
      const success = await db.deleteTask(id);
      if (success) {
        setTasks(prev => prev.filter(t => t.id !== id));
        if (focusedTask?.id === id) {
          const remaining = tasks.filter(t => t.id !== id && !t.completed);
          setFocusedTask(remaining.length > 0 ? remaining[0] : null);
        }
        addNotification('Task deleted', 'success');
      }
    } catch (err) {
      addNotification('Error deleting task', 'error');
    }
  };

  // Get tasks filtered by priority
  const getTasksByPriority = (priority: Task['priority']) => {
    return tasks.filter(t => t.priority === priority);
  };

  // Priority metadata for mapping quadrants
  const quadrants = [
    {
      id: 'urgent_important' as Task['priority'],
      name: 'Do First (Urgent & Important)',
      icon: Flame,
      colorClass: styles['quad-urgent_important'],
      badgeClass: 'badge-exam'
    },
    {
      id: 'not_urgent_important' as Task['priority'],
      name: 'Schedule (Important & Not Urgent)',
      icon: Target,
      colorClass: styles['quad-not_urgent_important'],
      badgeClass: 'badge-class'
    },
    {
      id: 'urgent_not_important' as Task['priority'],
      name: 'Delegate (Urgent & Not Important)',
      icon: Clock,
      colorClass: styles['quad-urgent_not_important'],
      badgeClass: 'badge-study'
    },
    {
      id: 'not_urgent_not_important' as Task['priority'],
      name: 'Eliminate (Not Urgent & Not Important)',
      icon: Award,
      colorClass: styles['quad-not_urgent_not_important'],
      badgeClass: 'badge-other'
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, background: 'var(--gradient-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Tasks & Pomodoro
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Organize tasks using the Eisenhower Priority Matrix and study efficiently with a synced Pomodoro timer.</p>
      </div>

      <div className={styles.container}>
        {/* Left Column: Pomodoro Timer */}
        <div className={styles.leftCol}>
          <div className={`${styles.timerCard} glass-panel`}>
            <h2 className={styles.timerTitle}>
              <Clock size={20} className="text-glow" /> Focus Timer
            </h2>

            {/* Mode selection tabs */}
            <div className={styles.timerModes}>
              <button 
                onClick={() => handleModeChange('focus')}
                className={`${styles.modeBtn} ${timerMode === 'focus' ? styles.modeBtnActive : ''}`}
              >
                Study Session
              </button>
              <button 
                onClick={() => handleModeChange('shortBreak')}
                className={`${styles.modeBtn} ${timerMode === 'shortBreak' ? styles.modeBtnActive : ''}`}
              >
                Short Break
              </button>
              <button 
                onClick={() => handleModeChange('longBreak')}
                className={`${styles.modeBtn} ${timerMode === 'longBreak' ? styles.modeBtnActive : ''}`}
              >
                Long Break
              </button>
            </div>

            {/* Circular Progress SVG */}
            <div className={styles.timerCircleWrapper}>
              <svg className={styles.svgRing} width="200" height="200">
                <circle 
                  className={styles.trackCircle} 
                  cx="100" 
                  cy="100" 
                  r={radius} 
                />
                <circle 
                  className={`${styles.progressCircle} ${timerMode !== 'focus' ? styles.progressCircleBreak : ''}`} 
                  cx="100" 
                  cy="100" 
                  r={radius} 
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <span className={styles.timeDisplay}>{formatTimeStr(timeRemaining)}</span>
              <span className={styles.timerLabel}>
                {timerMode === 'focus' ? 'Focus Sprint' : 'Rest Break'}
              </span>
            </div>

            {/* Timer Controllers */}
            <div className={styles.timerControls}>
              <button 
                onClick={toggleTimer}
                className="btn-primary" 
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {timerActive ? <Pause size={18} /> : <Play size={18} />}
                <span>{timerActive ? 'Pause' : 'Start'}</span>
              </button>
              <button 
                onClick={resetTimer}
                className="btn-secondary" 
                style={{ flex: 1, padding: '12px' }}
                title="Reset Session"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            {/* Display Focused Task */}
            {focusedTask && (
              <div className={styles.timerFocusTask}>
                <Target size={14} />
                <span style={{ fontWeight: 600 }}>Focusing on:</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                  {focusedTask.title}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Eisenhower Priority Matrix */}
        <div>
          <div className={styles.matrixGrid}>
            {quadrants.map((quad) => {
              const quadTasks = getTasksByPriority(quad.id);
              const QuadIcon = quad.icon;
              return (
                <div key={quad.id} className={`${styles.quadrant} ${quad.colorClass} glass-panel`}>
                  <div className={styles.quadTitle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <QuadIcon size={16} />
                      {quad.name}
                    </span>
                    <span className={styles.quadCount}>{quadTasks.length}</span>
                  </div>

                  <div className={styles.taskList}>
                    {quadTasks.length > 0 ? (
                      quadTasks.map((task) => (
                        <div key={task.id} className={styles.taskItem}>
                          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                            <input 
                              type="checkbox" 
                              checked={task.completed}
                              onChange={() => handleToggleTask(task.id, task.completed)}
                              className={styles.taskCheckbox}
                            />
                            <div className={styles.taskDetails}>
                              <span className={`${styles.taskTitleText} ${task.completed ? styles.taskCompleted : ''}`}>
                                {task.title}
                              </span>
                              <div className={styles.taskMeta}>
                                {task.due_date && (
                                  <span>Due: {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                )}
                                {task.pomodoro_count > 0 && (
                                  <span className={styles.pomodoroIndicator}>
                                    <Flame size={10} />
                                    {task.pomodoro_count} {task.pomodoro_count === 1 ? 'pomodoro' : 'pomodoros'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className={styles.actionsGroup}>
                            <button 
                              onClick={() => setFocusedTask(task)}
                              className={`${styles.focusTaskBtn} ${focusedTask?.id === task.id ? styles.focusTaskBtnActive : ''}`}
                              title="Set as active timer focus task"
                              disabled={task.completed}
                            >
                              <Target size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className={styles.deleteBtn}
                              title="Delete Task"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptyState}>No items in this quadrant.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Add Task */}
          <div className={`${styles.addCard} glass-panel`}>
            <h2 className={styles.timerTitle} style={{ fontSize: '18px', marginBottom: '16px' }}>
              <PlusCircle className="text-glow" size={18} /> Add Priority Task
            </h2>
            <form onSubmit={handleAddTask}>
              <div className={styles.formGrid}>
                <input 
                  type="text" 
                  placeholder="What needs to be done?" 
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="form-input"
                  required
                />
                
                <select 
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as Task['priority'])}
                  className="form-input"
                  style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'white' }}
                >
                  <option value="urgent_important" style={{ background: '#0e1222' }}>Do First (Urgent & Imp)</option>
                  <option value="not_urgent_important" style={{ background: '#0e1222' }}>Schedule (Imp & Not Urg)</option>
                  <option value="urgent_not_important" style={{ background: '#0e1222' }}>Delegate (Urg & Not Imp)</option>
                  <option value="not_urgent_not_important" style={{ background: '#0e1222' }}>Eliminate (Not Urg & Not Imp)</option>
                </select>

                <input 
                  type="date" 
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="form-input"
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
              >
                <Plus size={16} />
                <span>Insert Task</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
