'use client';

import React, { useState, useEffect } from 'react';
import { db, StudyPlan, CalendarEvent } from '@/lib/db';
import { useApp } from '@/components/AppContext';
import styles from '@/styles/components/PlannerPage.module.css';
import ConflictModal from '@/components/ConflictModal';
import { checkEventConflict } from '@/lib/conflict';
import { 
  Sparkles, 
  Brain, 
  ArrowLeft, 
  ArrowRight, 
  CalendarCheck, 
  Calendar as CalendarIcon,
  CheckCircle,
  FileText,
  Clock,
  TrendingUp,
  Bookmark
} from 'lucide-react';

export default function PlannerPage() {
  const { userApiKey, addNotification } = useApp();
  
  // Wizard steps: 1 = Exam Details, 2 = Study Constraints, 3 = Topics
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [planEvents, setPlanEvents] = useState<Omit<CalendarEvent, 'id'>[]>([]);
  const [scheduleApplied, setScheduleApplied] = useState(false);

  // Conflict Resolution State
  const [conflictQueue, setConflictQueue] = useState<Array<{ newEvent: Omit<CalendarEvent, 'id'> | CalendarEvent; conflicting: CalendarEvent[] }>>([]);
  const [safeEventsToImport, setSafeEventsToImport] = useState<Omit<CalendarEvent, 'id'>[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    course: '',
    examTitle: '',
    examDate: '',
    difficulty: 3,
    dailyHours: 2,
    preferredTime: 'evening',
    studyStyle: 'pomodoro',
    topics: ''
  });

  // Load latest plan on mount
  useEffect(() => {
    async function loadLatestPlan() {
      try {
        const plans = await db.getStudyPlans();
        if (plans.length > 0) {
          // Find if there is an unapplied plan or just load the latest one
          setActivePlan(plans[0]);
          setScheduleApplied(plans[0].schedule_applied);
        }
      } catch (err) {
        console.error('Error loading study plan:', err);
      }
    }
    loadLatestPlan();
  }, []);

  // Wizard navigation
  const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  // Generate Plan via API
  const handleGeneratePlan = async () => {
    if (!formData.course || !formData.examTitle || !formData.examDate) {
      addNotification('Please fill in Course, Exam Title, and Date first.', 'warning');
      setStep(1);
      return;
    }

    setLoading(true);
    setActivePlan(null);
    setPlanEvents([]);
    setScheduleApplied(false);

    try {
      // Fetch existing events to pass to the API for collision avoidance
      const existingEvents = await db.getEvents();

      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          existingEvents,
          customKey: userApiKey
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Save generated plan to DB
      const createdPlan = await db.addStudyPlan({
        title: `${formData.course}: ${formData.examTitle} Plan`,
        created_at: new Date().toISOString(),
        content: data.markdown,
        schedule_applied: false
      });

      setActivePlan(createdPlan);
      setPlanEvents(data.events || []);
      addNotification('AI Study Plan generated!', 'success');

    } catch (err: any) {
      addNotification(`Planner failed: ${err.message || 'Check your Gemini key'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Write AI study events to calendar
  const handleApplyToCalendar = async () => {
    if (planEvents.length === 0 || !activePlan) return;

    try {
      const existingEvents = await db.getEvents();
      const queue: Array<{ newEvent: Omit<CalendarEvent, 'id'>; conflicting: CalendarEvent[] }> = [];
      const safeList: Omit<CalendarEvent, 'id'>[] = [];
      let tempCurrentEvents = [...existingEvents];

      for (const item of planEvents) {
        const conflicting = checkEventConflict(item, tempCurrentEvents);
        if (conflicting.length > 0) {
          queue.push({ newEvent: item, conflicting });
        } else {
          safeList.push(item);
          tempCurrentEvents.push({ ...item, id: 'temp' });
        }
      }

      if (queue.length > 0) {
        setConflictQueue(queue);
        setSafeEventsToImport(safeList);
        setIsConflictModalOpen(true);
        return;
      }

      const promises = planEvents.map(event => db.addEvent(event));
      await Promise.all(promises);

      // Update plan status
      await db.deleteStudyPlan(activePlan.id);
      const updatedPlan = await db.addStudyPlan({
        title: activePlan.title,
        created_at: activePlan.created_at,
        content: activePlan.content,
        schedule_applied: true
      });

      setActivePlan(updatedPlan);
      setScheduleApplied(true);
      addNotification(`Applied ${planEvents.length} study sessions to calendar!`, 'success');
    } catch (err) {
      addNotification('Could not schedule events', 'error');
    }
  };

  // Resolve conflict decisions for planner
  const handleResolveConflicts = async (resolutions: {
    toAdd: Omit<CalendarEvent, 'id'>[];
    toDelete: string[];
  }) => {
    setIsConflictModalOpen(false);
    setConflictQueue([]);

    if (!activePlan) return;

    try {
      // 1. Delete rejected existing events
      if (resolutions.toDelete.length > 0) {
        await Promise.all(resolutions.toDelete.map(id => db.deleteEvent(id)));
      }

      // 2. Add approved new events (including the conflict-free safe events)
      const eventsToCreate = [...safeEventsToImport, ...resolutions.toAdd];
      if (eventsToCreate.length > 0) {
        await Promise.all(eventsToCreate.map(evt => db.addEvent(evt)));
      }

      // 3. Update plan status
      await db.deleteStudyPlan(activePlan.id);
      const updatedPlan = await db.addStudyPlan({
        title: activePlan.title,
        created_at: activePlan.created_at,
        content: activePlan.content,
        schedule_applied: true
      });

      setActivePlan(updatedPlan);
      setScheduleApplied(true);

      addNotification(
        `Applied ${eventsToCreate.length} study sessions to calendar` + 
        (resolutions.toDelete.length > 0 ? `, removed ${resolutions.toDelete.length} conflict(s).` : '.'),
        'success'
      );

      setSafeEventsToImport([]);
    } catch (err) {
      addNotification('Failed to apply conflict resolutions', 'error');
    }
  };

  // Render markdown parser
  const renderMarkdown = (md: string) => {
    if (!md) return null;
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} style={{ color: 'var(--accent-primary)', marginBottom: '16px' }}>{line.substring(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} style={{ color: 'var(--accent-secondary)', margin: '20px 0 10px 0' }}>{line.substring(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} style={{ color: 'var(--accent-tertiary)', margin: '14px 0 8px 0' }}>{line.substring(4)}</h3>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.substring(2);
        return <li key={idx} style={{ marginLeft: '20px', marginBottom: '6px' }} dangerouslySetInnerHTML={{ __html: parseBold(text) }} />;
      }
      if (line.trim() === '') {
        return <div key={idx} style={{ height: '10px' }} />;
      }
      return <p key={idx} style={{ marginBottom: '10px' }} dangerouslySetInnerHTML={{ __html: parseBold(line) }} />;
    });
  };

  const parseBold = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, background: 'var(--gradient-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Adaptive Study Planner
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Enter your academic deadlines and study constraints, and Gemini will map out an optimal study calendar.</p>
      </div>

      <div className={styles.container}>
        {/* Left Column: Multi-Step Wizard Form */}
        <div className={`${styles.wizardCard} glass-panel`}>
          <div className={styles.stepIndicator}>
            <h2 className={styles.title}>
              <Brain size={20} /> Wizard Step {step}/3
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className={`${styles.stepDot} ${step >= 1 ? styles.stepDotActive : ''}`} />
              <span className={`${styles.stepDot} ${step >= 2 ? styles.stepDotActive : ''}`} />
              <span className={`${styles.stepDot} ${step >= 3 ? styles.stepDotActive : ''}`} />
            </div>
          </div>

          {step === 1 && (
            /* Step 1: Exam Details */
            <div className="animate-fade-in">
              <h3 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Exam Objectives & Schedule</h3>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Course / Subject Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. CS101: Intro to Programming" 
                  value={formData.course}
                  onChange={(e) => setFormData({...formData, course: e.target.value})}
                  className="form-input"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Exam Topic Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Final Exam, Midterm 1" 
                  value={formData.examTitle}
                  onChange={(e) => setFormData({...formData, examTitle: e.target.value})}
                  className="form-input"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Exam Date</label>
                <input 
                  type="date" 
                  value={formData.examDate}
                  onChange={(e) => setFormData({...formData, examDate: e.target.value})}
                  className="form-input"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Subject Difficulty (1 = Easy, 5 = Very Hard)</label>
                <div className={styles.sliderWrapper}>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    value={formData.difficulty}
                    onChange={(e) => setFormData({...formData, difficulty: parseInt(e.target.value)})}
                    className={styles.slider}
                  />
                  <span className={styles.sliderVal}>{formData.difficulty}</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            /* Step 2: Study Budget & Preferences */
            <div className="animate-fade-in">
              <h3 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Daily Constraints & Preferences</h3>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Daily Study Hours Budget</label>
                <div className={styles.sliderWrapper}>
                  <input 
                    type="range" 
                    min="1" 
                    max="8" 
                    value={formData.dailyHours}
                    onChange={(e) => setFormData({...formData, dailyHours: parseInt(e.target.value)})}
                    className={styles.slider}
                  />
                  <span className={styles.sliderVal}>{formData.dailyHours}h</span>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Preferred Study Time</label>
                <select 
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({...formData, preferredTime: e.target.value})}
                  className="form-input"
                  style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'white' }}
                >
                  <option value="morning" style={{ background: '#0e1222' }}>Morning (9:00 AM - 12:00 PM)</option>
                  <option value="afternoon" style={{ background: '#0e1222' }}>Afternoon (1:00 PM - 4:00 PM)</option>
                  <option value="evening" style={{ background: '#0e1222' }}>Evening (6:00 PM - 9:00 PM)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Cognitive Learning Style</label>
                <select 
                  value={formData.studyStyle}
                  onChange={(e) => setFormData({...formData, studyStyle: e.target.value})}
                  className="form-input"
                  style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'white' }}
                >
                  <option value="pomodoro" style={{ background: '#0e1222' }}>Pomodoro Sprint (25m Focus / 5m Break)</option>
                  <option value="active_recall" style={{ background: '#0e1222' }}>Active Recall & Flashcard Quizzing</option>
                  <option value="reading" style={{ background: '#0e1222' }}>Visual Reading & Summarization</option>
                  <option value="practice" style={{ background: '#0e1222' }}>Practical Exercises & Problem Solving</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            /* Step 3: Topics List */
            <div className="animate-fade-in">
              <h3 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Curriculum Details</h3>

              <div className={styles.formGroup}>
                <label className={styles.label}>Core Chapters / Concepts to Cover</label>
                <textarea 
                  placeholder="Example: Chapters 1-4, Big O Complexity, Sorting Algorithms (Quick Sort, Merge Sort), Trees and Graph traversals..." 
                  value={formData.topics}
                  onChange={(e) => setFormData({...formData, topics: e.target.value})}
                  className="form-input"
                  style={{ minHeight: '180px', resize: 'vertical' }}
                  required
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className={styles.buttonGroup}>
            <button 
              onClick={prevStep}
              className="btn-secondary"
              style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
            >
              <ArrowLeft size={16} /> Back
            </button>

            {step < 3 ? (
              <button onClick={nextStep} className="btn-primary">
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button 
                onClick={handleGeneratePlan}
                disabled={loading}
                className="btn-primary"
                style={{ background: 'var(--gradient-brand)' }}
              >
                {loading ? (
                  <>
                    <span className={styles.loadingSpinner} />
                    <span>Mapping Plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate AI Plan</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Display Plan */}
        <div>
          {activePlan ? (
            <div className={`${styles.planCard} glass-panel`}>
              <div className={styles.planHeader}>
                <div>
                  <h2 className={styles.planTitle}>{activePlan.title}</h2>
                  <div className={styles.planMeta}>
                    Generated on {new Date(activePlan.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Show calendar apply banner if events exist and haven't been applied */}
              {planEvents.length > 0 && !scheduleApplied && (
                <div className={styles.applyPanel}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CalendarIcon className="text-glow" size={24} />
                    <div>
                      <span className={styles.applyText}>AI Calendar Booking Ready</span>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Gemini scheduled {planEvents.length} study sessions at your preferred times.
                      </p>
                    </div>
                  </div>
                  <button className="btn-primary" onClick={handleApplyToCalendar}>
                    <CalendarCheck size={16} /> Book Calendar
                  </button>
                </div>
              )}

              {scheduleApplied && (
                <div className={styles.applyPanel} style={{ background: 'rgba(20, 184, 166, 0.02)', borderColor: 'rgba(20, 184, 166, 0.2)', animation: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CheckCircle style={{ color: 'var(--accent-tertiary)' }} size={24} />
                    <div>
                      <span className={styles.applyText} style={{ color: 'var(--text-primary)' }}>Calendar Booked Successfully</span>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Study sessions are locked into your schedule agenda.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.planContent}>
                {renderMarkdown(activePlan.content)}
              </div>
            </div>
          ) : (
            <div className={`${styles.planCard} glass-panel ${styles.emptyState}`}>
              <Brain size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h2>No active study plan</h2>
              <p>Complete the Study Planner Wizard to generate a cognitive-balanced study program and schedule.</p>
            </div>
          )}
        </div>
      </div>
      
      <ConflictModal
        isOpen={isConflictModalOpen}
        conflicts={conflictQueue}
        onResolve={handleResolveConflicts}
        onCancel={() => {
          setIsConflictModalOpen(false);
          setConflictQueue([]);
          setSafeEventsToImport([]);
        }}
      />
    </div>
  );
}
