'use client';

import React, { useState, useEffect } from 'react';
import { db, CalendarEvent } from '@/lib/db';
import { useApp } from '@/components/AppContext';
import styles from '@/styles/components/CalendarPage.module.css';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Plus, 
  Sparkles, 
  Upload, 
  CheckCircle2,
  CalendarCheck
} from 'lucide-react';

export default function CalendarPage() {
  const { userApiKey, addNotification } = useApp();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Syllabus parser state
  const [syllabusText, setSyllabusText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<CalendarEvent[]>([]);

  // Manual event form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'class' as CalendarEvent['type'],
    date: '',
    startTime: '',
    endTime: '',
    description: '',
    course: ''
  });

  // Load calendar events
  useEffect(() => {
    async function fetchEvents() {
      try {
        const data = await db.getEvents();
        setEvents(data);
      } catch (err) {
        addNotification('Could not load calendar events', 'error');
      }
    }
    fetchEvents();
  }, [addNotification]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of the month (0 = Sunday, 1 = Monday...)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Total days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Total days in previous month
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Check if date is today
  const isToday = (dayNum: number, isCurrentMonth: boolean) => {
    const today = new Date();
    return today.getDate() === dayNum && 
      today.getMonth() === month && 
      today.getFullYear() === year &&
      isCurrentMonth;
  };

  // Check if date is selected
  const isSelected = (dayNum: number, isCurrentMonth: boolean) => {
    return selectedDate.getDate() === dayNum &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year &&
      isCurrentMonth;
  };

  // Handle cell click
  const selectDay = (dayNum: number, isCurrentMonth: boolean) => {
    if (isCurrentMonth) {
      setSelectedDate(new Date(year, month, dayNum));
    }
  };

  // Get events for specific day
  const getDayEvents = (dayNum: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return [];
    const checkDateStr = new Date(year, month, dayNum).toDateString();
    return events.filter(e => new Date(e.start_time).toDateString() === checkDateStr);
  };

  // Selected day events list
  const selectedDayEvents = events.filter(
    e => new Date(e.start_time).toDateString() === selectedDate.toDateString()
  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // Delete event
  const handleDeleteEvent = async (id: string) => {
    try {
      const success = await db.deleteEvent(id);
      if (success) {
        setEvents(prev => prev.filter(e => e.id !== id));
        addNotification('Event removed from schedule', 'success');
      }
    } catch (err) {
      addNotification('Could not delete event', 'error');
    }
  };

  // Manual event submit
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime) {
      addNotification('Please fill in all required fields', 'warning');
      return;
    }

    try {
      const startIso = new Date(`${newEvent.date}T${newEvent.startTime}`).toISOString();
      const endIso = new Date(`${newEvent.date}T${newEvent.endTime}`).toISOString();

      const created = await db.addEvent({
        title: newEvent.title,
        type: newEvent.type,
        start_time: startIso,
        end_time: endIso,
        description: newEvent.description,
        course: newEvent.course
      });

      setEvents(prev => [...prev, created]);
      addNotification('Event added to calendar!', 'success');
      
      // Reset form
      setNewEvent({
        title: '',
        type: 'class',
        date: '',
        startTime: '',
        endTime: '',
        description: '',
        course: ''
      });
    } catch (err) {
      addNotification('Error adding event', 'error');
    }
  };

  // Trigger AI syllabus parsing
  const handleParseSyllabus = async () => {
    if (!syllabusText.trim()) {
      addNotification('Please paste syllabus text first', 'warning');
      return;
    }

    setParsing(true);
    setParsedPreview([]);
    try {
      const res = await fetch('/api/parse-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: syllabusText,
          customKey: userApiKey,
          referenceDate: new Date().toISOString()
        })
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.events && Array.isArray(data.events)) {
        setParsedPreview(data.events);
        addNotification(`AI extracted ${data.events.length} schedule events!`, 'success');
      } else {
        throw new Error('Could not parse any schedule events.');
      }
    } catch (err: any) {
      addNotification(`Parsing failed: ${err.message || 'Check your API key'}`, 'error');
    } finally {
      setParsing(false);
    }
  };

  // Confirm and write parsed events to db
  const handleImportAllEvents = async () => {
    if (parsedPreview.length === 0) return;
    
    try {
      const promises = parsedPreview.map(event => db.addEvent({
        title: event.title,
        type: event.type,
        start_time: event.start_time,
        end_time: event.end_time,
        description: event.description,
        course: event.course
      }));

      const addedEvents = await Promise.all(promises);
      setEvents(prev => [...prev, ...addedEvents]);
      addNotification(`Successfully imported ${addedEvents.length} events!`, 'success');
      setParsedPreview([]);
      setSyllabusText('');
    } catch (err) {
      addNotification('Failed to import some events', 'error');
    }
  };

  // Render month cells
  const renderDays = () => {
    const cells = [];
    
    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      cells.push(
        <div key={`prev-${dayNum}`} className={`${styles.dayCell} ${styles.outOfMonth}`}>
          <span className={styles.dayNumber}>{dayNum}</span>
        </div>
      );
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const dayEvents = getDayEvents(day, true);
      const isDayToday = isToday(day, true);
      const isDaySelected = isSelected(day, true);

      cells.push(
        <div 
          key={`day-${day}`} 
          className={`${styles.dayCell} ${isDayToday ? styles.todayCell : ''} ${isDaySelected ? styles.selectedCell : ''}`}
          onClick={() => selectDay(day, true)}
        >
          <span className={styles.dayNumber}>{day}</span>
          <div className={styles.eventDots}>
            {dayEvents.map(e => (
              <span key={e.id} className={`${styles.eventDot} ${styles[`dot-${e.type}`]}`} title={e.title} />
            ))}
          </div>
        </div>
      );
    }

    // Next month filler days to complete calendar grid (multiple rows of 7, total grid cells is usually 35 or 42)
    const totalGridCells = cells.length > 35 ? 42 : 35;
    const nextMonthDaysNeeded = totalGridCells - cells.length;
    for (let day = 1; day <= nextMonthDaysNeeded; day++) {
      cells.push(
        <div key={`next-${day}`} className={`${styles.dayCell} ${styles.outOfMonth}`}>
          <span className={styles.dayNumber}>{day}</span>
        </div>
      );
    }

    return cells;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, background: 'var(--gradient-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Schedule Manager
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Track classes, exams, and use AI to automatically extract course schedules from syllabi.</p>
      </div>

      <div className={styles.container}>
        {/* Left Column: AI Syllabus Importer & Add Event */}
        <div className={styles.leftCol}>
          {/* Syllabus Importer */}
          <div className={`${styles.parserCard} glass-panel`}>
            <h2 className={styles.title}>
              <Sparkles size={20} className="text-glow" /> AI Syllabus Importer
            </h2>
            <p className={styles.subtitle}>Paste course syllabus text below to automatically extract lectures, midterms, and project deadlines.</p>

            <textarea 
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              placeholder="Example: Syllabus CS101: Midterm Exam is scheduled on Oct 25 from 10:00 AM to 12:00 PM. Weekly classes on Tuesdays & Thursdays from 2 PM to 3:30 PM..." 
              className={`${styles.textarea} form-input`}
            />

            <button 
              onClick={handleParseSyllabus}
              disabled={parsing}
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {parsing ? (
                <>
                  <span className={styles.loadingSpinner} />
                  <span>AI Parsing Syllabus...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Extract Schedule</span>
                </>
              )}
            </button>

            {/* AI Parsed Preview */}
            {parsedPreview.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 className={styles.title} style={{ fontSize: '15px' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--accent-tertiary)' }} /> extracted Events Preview
                </h3>
                <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', margin: '10px 0' }}>
                  {parsedPreview.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '8px 0' }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>[{item.type.toUpperCase()}]</strong> {item.title}
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {new Date(item.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleImportAllEvents}
                  className="btn-primary" 
                  style={{ width: '100%', background: 'var(--gradient-brand)', justifyContent: 'center' }}
                >
                  <CalendarCheck size={18} />
                  <span>Import {parsedPreview.length} Events</span>
                </button>
              </div>
            )}
          </div>

          {/* Add Manual Event */}
          <div className={`${styles.addEventCard} glass-panel`}>
            <h2 className={styles.title}>
              <Plus size={20} /> Add Event
            </h2>
            <form onSubmit={handleAddEvent}>
              <div className={styles.formGrid}>
                <div className={styles.fullWidth}>
                  <input 
                    type="text" 
                    placeholder="Event Title" 
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
                <div className={styles.fullWidth}>
                  <select 
                    value={newEvent.type}
                    onChange={(e) => setNewEvent({...newEvent, type: e.target.value as CalendarEvent['type']})}
                    className={styles.select}
                  >
                    <option value="class">Class</option>
                    <option value="exam">Exam</option>
                    <option value="assignment">Assignment</option>
                    <option value="study_session">Study Session</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className={styles.fullWidth}>
                  <input 
                    type="date" 
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <input 
                    type="time" 
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({...newEvent, startTime: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <input 
                    type="time" 
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({...newEvent, endTime: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
                <div className={styles.fullWidth}>
                  <input 
                    type="text" 
                    placeholder="Course name (e.g. CS101)" 
                    value={newEvent.course}
                    onChange={(e) => setNewEvent({...newEvent, course: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className={styles.fullWidth}>
                  <input 
                    type="text" 
                    placeholder="Description / Location" 
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>Add to Calendar</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Custom Calendar View */}
        <div>
          <div className={`${styles.calendarCard} glass-panel`}>
            <div className={styles.calendarHeader}>
              <h2 className={styles.monthTitle}>
                {monthNames[month]} {year}
              </h2>
              <div className={styles.navGroup}>
                <button className={styles.navBtn} onClick={prevMonth}>
                  <ChevronLeft size={20} />
                </button>
                <button className={styles.navBtn} onClick={nextMonth}>
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className={styles.weekdaysGrid}>
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            <div className={styles.daysGrid}>
              {renderDays()}
            </div>

            {/* Selected day agenda */}
            <div className={styles.dayEventsList}>
              <h3 className={styles.dayEventsTitle}>
                Schedule for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </h3>

              {selectedDayEvents.length > 0 ? (
                <div className={styles.eventListContainer}>
                  {selectedDayEvents.map((item) => {
                    const startTime = new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const endTime = new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    // Get Badge type
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
                      <div key={item.id} className={`${styles.eventItem} glass-panel`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span className={`badge ${getBadge(item.type)}`}>{item.type}</span>
                          <div>
                            <span className={styles.eventTitle}>{item.title}</span>
                            <span className={styles.eventTime} style={{ display: 'block' }}>{startTime} - {endTime} {item.course ? `| ${item.course}` : ''}</span>
                            {item.description && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{item.description}</p>}
                          </div>
                        </div>
                        <button 
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteEvent(item.id)}
                          title="Delete Event"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '14px' }}>No events scheduled for this day.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
