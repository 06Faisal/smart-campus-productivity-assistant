'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db, CalendarEvent, Task, Lecture } from '@/lib/db';
import { auth, UserProfile } from '@/lib/auth';
import { runDeadlineSweeper, DeadlineAlert } from '@/lib/sweeper';
import { getGeminiClient, GEMINI_MODEL, generateContentWithRetry } from '@/lib/gemini';
import { useApp } from '@/components/AppContext';
import styles from '@/styles/components/Dashboard.module.css';
import { 
  Clock, 
  CheckCircle, 
  AlertOctagon, 
  BookOpen, 
  Calendar as CalendarIcon, 
  Sparkles, 
  ArrowRight,
  TrendingUp,
  LogOut,
  Bell,
  AlertTriangle
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const { userApiKey, addNotification } = useApp();
  
  // Dashboard states
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  
  // User Profile & Sweeper states
  const [user, setUser] = useState<UserProfile | null>(null);
  const [alerts, setAlerts] = useState<DeadlineAlert[]>([]);
  
  // Coach states
  const [aiTip, setAiTip] = useState('Loading your customized study advice...');
  const [generatingTip, setGeneratingTip] = useState(false);

  // Load stats data, profile, and sweeper alerts
  useEffect(() => {
    async function loadData() {
      try {
        const [fetchedEvents, fetchedTasks, fetchedLectures, currentUser, activeAlerts] = await Promise.all([
          db.getEvents(),
          db.getTasks(),
          db.getLectures(),
          auth.getCurrentUser(),
          runDeadlineSweeper()
        ]);
        
        setEvents(fetchedEvents);
        setTasks(fetchedTasks);
        setLectures(fetchedLectures);
        setUser(currentUser);
        setAlerts(activeAlerts);
        
        // If the sweeper injected new tasks, re-fetch tasks to display updated list
        if (activeAlerts.length > 0) {
          const updatedTasks = await db.getTasks();
          setTasks(updatedTasks);
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Generate AI Coach Tip
  useEffect(() => {
    if (loading) return;

    async function generateCoachTip() {
      setGeneratingTip(true);
      const pendingTasks = tasks.filter(t => !t.completed);
      const upcomingExams = events.filter(e => e.type === 'exam' && new Date(e.start_time) >= new Date());
      const studySessions = events.filter(e => e.type === 'study_session');

      const dataSummary = `
        - Student Name: ${user?.name || 'Scholar'}
        - Number of pending tasks: ${pendingTasks.length}
        - Upcoming exams: ${upcomingExams.map(e => `${e.title} on ${new Date(e.start_time).toLocaleDateString()}`).join(', ') || 'None'}
        - Total study sessions logged: ${studySessions.length}
        - Total lectures recorded: ${lectures.length}
      `;

      try {
        const client = getGeminiClient(userApiKey);
        const prompt = `You are an AI Smart Campus Coach. Based on the student's status below, provide a short, motivating, and actionable advice (maximum 2-3 sentences) for their productivity today. Address them by name if possible. Keep it friendly and energetic:
        
        Student academic state:
        ${dataSummary}
        
        Return ONLY the coaching message text. No extra headings or preamble.`;

        const response = await generateContentWithRetry(client, {
          model: GEMINI_MODEL,
          contents: prompt,
        });

        if (response.text) {
          setAiTip(response.text.trim());
        } else {
          throw new Error('No text returned');
        }
      } catch (err) {
        const fallbacks = [
          "Focus on your most critical tasks first. Remember to take short breaks to keep your mind fresh!",
          "Exam prep is about consistency, not cramming. Try planning a 45-minute Pomodoro study block today.",
          "Keep logging those notes! Reviewing your lecture summaries within 24 hours boosts retention by up to 80%.",
          "Your dashboard is all clean. Use this free time to create a personalized study plan for the upcoming week!"
        ];
        if (upcomingExams.length > 0) {
          setAiTip(`Hey ${user?.name || 'Scholar'}, you have an exam coming up! Take a breath, break down the syllabus, and tackle one core topic today. Consistent revision is key.`);
        } else if (pendingTasks.length > 3) {
          setAiTip(`You have ${pendingTasks.length} pending items. Pick the absolute highest priority task from your Eisenhower Matrix and focus solely on that for 30 minutes.`);
        } else {
          setAiTip(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
        }
      } finally {
        setGeneratingTip(false);
      }
    }

    generateCoachTip();
  }, [loading, tasks, events, lectures, user, userApiKey]);

  // Compute Stats
  const activeExams = events.filter(e => e.type === 'exam' && new Date(e.start_time) >= new Date()).length;
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const totalTasksCount = tasks.length;
  
  // Total study hours: logged Pomodoro sessions (25 mins each) + custom study session durations
  const studyEvents = events.filter(e => e.type === 'study_session');
  let totalStudyMinutes = tasks.reduce((acc, t) => acc + (t.pomodoro_count * 25), 0);
  studyEvents.forEach(e => {
    const diff = new Date(e.end_time).getTime() - new Date(e.start_time).getTime();
    totalStudyMinutes += Math.round(diff / 60000);
  });
  const studyHours = (totalStudyMinutes / 60).toFixed(1);

  // Filter Today's Agenda
  const todayStr = new Date().toDateString();
  const todayEvents = events.filter(e => new Date(e.start_time).toDateString() === todayStr)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // Logout Handler
  const handleLogout = async () => {
    try {
      await auth.signOut();
      addNotification('Logged out successfully.', 'info');
      router.replace('/login');
    } catch (err) {
      addNotification('Logout failed.', 'error');
    }
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div>
      {/* Dashboard Header with User info */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Welcome back, {user?.name || 'Scholar'}. Ready for another productive day?</p>
        </div>
        
        <div className={styles.profileArea}>
          <div className={styles.dateBadge} style={{ marginRight: '10px' }}>
            {formattedDate}
          </div>
          
          {user && (
            <div className={styles.userCard}>
              <div className={styles.avatarRing}>
                <div className={styles.avatarInner}>
                  {user.avatar}
                </div>
              </div>
              <span className={styles.userName}>{user.name}</span>
              <button 
                onClick={handleLogout} 
                className={styles.logoutBtn}
                title="Sign Out"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Deadline Sweeper Alerts Panel */}
      {alerts.length > 0 && (
        <div className={styles.alertsSection}>
          {alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`${styles.alertBox} ${alert.type === 'assignment' ? styles.alertBoxAssignment : ''}`}
            >
              <div className={styles.alertLeft}>
                <div className={styles.alertIconWrapper}>
                  {alert.type === 'exam' ? <AlertOctagon size={22} /> : <AlertTriangle size={22} />}
                </div>
                <div>
                  <h3 className={styles.alertTitle}>
                    {alert.type === 'exam' ? 'Exam Alert' : 'Assignment Deadline Nearing'}
                  </h3>
                  <p className={styles.alertDesc}>
                    <strong>"{alert.title}"</strong> is scheduled in {alert.daysLeft} {alert.daysLeft === 1 ? 'day' : 'days'} ({new Date(alert.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}).
                    {alert.type === 'exam' 
                      ? ' We have added a study preparation task. Plan your review blocks now!'
                      : ' High priority task created. Be sure to submit on time.'
                    }
                  </p>
                </div>
              </div>
              
              <Link href="/tasks">
                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  <span>Solve Task</span>
                  <ArrowRight size={14} />
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statIcon}>
            <Clock size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{studyHours}h</span>
            <span className={styles.statLabel}>Logged Study</span>
          </div>
        </div>

        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statIcon}>
            <CheckCircle size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>
              {totalTasksCount > 0 ? `${completedTasksCount}/${totalTasksCount}` : '0/0'}
            </span>
            <span className={styles.statLabel}>Tasks Done</span>
          </div>
        </div>

        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statIcon}>
            <AlertOctagon size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{activeExams}</span>
            <span className={styles.statLabel}>Exams Ahead</span>
          </div>
        </div>

        <div className={`${styles.statCard} glass-panel`}>
          <div className={styles.statIcon}>
            <BookOpen size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{lectures.length}</span>
            <span className={styles.statLabel}>Lecture Summaries</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className={styles.dashboardGrid}>
        {/* Left Column: Agenda */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <h2 className={styles.panelTitle}>
            <CalendarIcon className={styles.panelTitleIcon} size={22} />
            Today's Agenda
          </h2>

          {loading ? (
            <div className={styles.emptyState}>Loading agenda details...</div>
          ) : todayEvents.length > 0 ? (
            <div className={styles.agendaList}>
              {todayEvents.map((item) => {
                const startTime = new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const endTime = new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                const getBadge = (t: string) => {
                  switch (t) {
                    case 'class': return 'badge-class';
                    case 'exam': return 'badge-exam';
                    case 'assignment': return 'badge-assignment';
                    case 'study_session': return 'badge-study';
                    default: return 'badge-other';
                  }
                };

                return (
                  <div key={item.id} className={`${styles.agendaItem} glass-panel`}>
                    <div className={styles.agendaContent}>
                      <span className={styles.agendaTime}>{startTime} - {endTime}</span>
                      <div className={styles.agendaDetails}>
                        <span className={styles.agendaSubject}>{item.title}</span>
                        {item.description && <span className={styles.agendaDesc}>{item.description}</span>}
                      </div>
                    </div>
                    <span className={`badge ${getBadge(item.type)}`}>{item.type}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>Your calendar is empty for today.</p>
              <Link href="/calendar">
                <button className="btn-secondary" style={{ marginTop: '10px' }}>
                  Schedule Classes
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Right Column: AI Coach and Actions */}
        <div>
          {/* AI Coach Nudges */}
          <div className={`${styles.coachCard} glass-panel`}>
            <h3 className={styles.coachTitle}>
              <Sparkles size={18} /> AI Campus Coach
            </h3>
            <p className={styles.coachText}>
              "{aiTip}"
            </p>
          </div>

          {/* Quick Actions */}
          <div className="glass-panel" style={{ padding: '30px' }}>
            <h2 className={styles.panelTitle} style={{ fontSize: '18px', marginBottom: '20px' }}>
              <TrendingUp className={styles.panelTitleIcon} size={18} />
              Quick Actions
            </h2>
            <div className={styles.quickActions}>
              <Link href="/calendar">
                <button className={styles.actionBtn}>
                  <span>Import Course Syllabus</span>
                  <ArrowRight className={styles.actionBtnIcon} size={16} />
                </button>
              </Link>
              <Link href="/lectures">
                <button className={styles.actionBtn}>
                  <span>Record Live Lecture</span>
                  <ArrowRight className={styles.actionBtnIcon} size={16} />
                </button>
              </Link>
              <Link href="/planner">
                <button className={styles.actionBtn}>
                  <span>Generate AI Study Plan</span>
                  <ArrowRight className={styles.actionBtnIcon} size={16} />
                </button>
              </Link>
              <Link href="/tasks">
                <button className={styles.actionBtn}>
                  <span>Start Pomodoro Session</span>
                  <ArrowRight className={styles.actionBtnIcon} size={16} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
