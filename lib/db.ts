import { supabase, isSupabaseConfigured } from './supabase';

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  description?: string;
  type: 'class' | 'exam' | 'assignment' | 'study_session' | 'other';
  course?: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string; // ISO string
  priority: 'urgent_important' | 'not_urgent_important' | 'urgent_not_important' | 'not_urgent_not_important';
  pomodoro_count: number;
}

export interface Lecture {
  id: string;
  title: string;
  created_at: string; // ISO string
  summary: string; // Markdown
  transcript?: string;
  flashcards?: Array<{ front: string; back: string }>;
  quiz?: Array<{
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
  }>;
}

export interface StudyPlan {
  id: string;
  title: string;
  created_at: string; // ISO string
  content: string; // Markdown
  schedule_applied: boolean;
}

// Utility to generate a random ID if not in DB
const generateId = () => Math.random().toString(36).substring(2, 15);

// Check if we are in browser
const isBrowser = typeof window !== 'undefined';

// Local storage helper
const getLocal = <T>(key: string): T[] => {
  if (!isBrowser) return [];
  const val = localStorage.getItem(`smart_campus_${key}`);
  return val ? JSON.parse(val) : [];
};

const setLocal = <T>(key: string, data: T[]) => {
  if (!isBrowser) return;
  localStorage.setItem(`smart_campus_${key}`, JSON.stringify(data));
};

export const db = {
  // --- CALENDAR EVENTS ---
  async getEvents(): Promise<CalendarEvent[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('events').select('*').order('start_time', { ascending: true });
      if (!error && data) return data as CalendarEvent[];
      console.warn("Supabase event fetch error, falling back to LocalStorage:", error);
    }
    return getLocal<CalendarEvent>('events');
  },

  async addEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    // Prevent duplicate entries (exact matches for title, times, and course)
    const existingEvents = await this.getEvents();
    const duplicate = existingEvents.find(e => 
      e.title === event.title &&
      new Date(e.start_time).getTime() === new Date(event.start_time).getTime() &&
      new Date(e.end_time).getTime() === new Date(event.end_time).getTime() &&
      (e.course || '') === (event.course || '')
    );
    if (duplicate) {
      return duplicate;
    }

    const newEvent: CalendarEvent = { ...event, id: generateId() };
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('events').insert([newEvent]).select();
      if (!error && data && data[0]) return data[0] as CalendarEvent;
      console.warn("Supabase event add error, falling back to LocalStorage:", error);
    }
    const local = getLocal<CalendarEvent>('events');
    local.push(newEvent);
    setLocal('events', local);
    return newEvent;
  },

  async deleteEvent(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (!error) return true;
      console.warn("Supabase event delete error, falling back to LocalStorage:", error);
    }
    const local = getLocal<CalendarEvent>('events');
    const filtered = local.filter(e => e.id !== id);
    setLocal('events', filtered);
    return true;
  },

  // --- TASKS ---
  async getTasks(): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
      if (!error && data) return data as Task[];
      console.warn("Supabase task fetch error, falling back to LocalStorage:", error);
    }
    return getLocal<Task>('tasks');
  },

  async addTask(task: Omit<Task, 'id'>): Promise<Task> {
    const newTask: Task = { ...task, id: generateId() };
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('tasks').insert([newTask]).select();
      if (!error && data && data[0]) return data[0] as Task;
      console.warn("Supabase task add error, falling back to LocalStorage:", error);
    }
    const local = getLocal<Task>('tasks');
    local.push(newTask);
    setLocal('tasks', local);
    return newTask;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select();
      if (!error && data && data[0]) return data[0] as Task;
      console.warn("Supabase task update error, falling back to LocalStorage:", error);
    }
    const local = getLocal<Task>('tasks');
    const index = local.findIndex(t => t.id === id);
    if (index === -1) return null;
    local[index] = { ...local[index], ...updates };
    setLocal('tasks', local);
    return local[index];
  },

  async deleteTask(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (!error) return true;
      console.warn("Supabase task delete error, falling back to LocalStorage:", error);
    }
    const local = getLocal<Task>('tasks');
    const filtered = local.filter(t => t.id !== id);
    setLocal('tasks', filtered);
    return true;
  },

  // --- LECTURES ---
  async getLectures(): Promise<Lecture[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('lectures').select('*').order('created_at', { ascending: false });
      if (!error && data) return data as Lecture[];
      console.warn("Supabase lecture fetch error, falling back to LocalStorage:", error);
    }
    return getLocal<Lecture>('lectures');
  },

  async addLecture(lecture: Omit<Lecture, 'id'>): Promise<Lecture> {
    const newLecture: Lecture = { ...lecture, id: generateId() };
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('lectures').insert([newLecture]).select();
      if (!error && data && data[0]) return data[0] as Lecture;
      console.warn("Supabase lecture add error, falling back to LocalStorage:", error);
    }
    const local = getLocal<Lecture>('lectures');
    local.unshift(newLecture);
    setLocal('lectures', local);
    return newLecture;
  },

  async deleteLecture(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('lectures').delete().eq('id', id);
      if (!error) return true;
      console.warn("Supabase lecture delete error, falling back to LocalStorage:", error);
    }
    const local = getLocal<Lecture>('lectures');
    const filtered = local.filter(l => l.id !== id);
    setLocal('lectures', filtered);
    return true;
  },

  // --- STUDY PLANS ---
  async getStudyPlans(): Promise<StudyPlan[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('study_plans').select('*').order('created_at', { ascending: false });
      if (!error && data) return data as StudyPlan[];
      console.warn("Supabase study plan fetch error, falling back to LocalStorage:", error);
    }
    return getLocal<StudyPlan>('study_plans');
  },

  async addStudyPlan(plan: Omit<StudyPlan, 'id'>): Promise<StudyPlan> {
    const newPlan: StudyPlan = { ...plan, id: generateId() };
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('study_plans').insert([newPlan]).select();
      if (!error && data && data[0]) return data[0] as StudyPlan;
      console.warn("Supabase study plan add error, falling back to LocalStorage:", error);
    }
    const local = getLocal<StudyPlan>('study_plans');
    local.unshift(newPlan);
    setLocal('study_plans', local);
    return newPlan;
  },

  async deleteStudyPlan(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('study_plans').delete().eq('id', id);
      if (!error) return true;
      console.warn("Supabase study plan delete error, falling back to LocalStorage:", error);
    }
    const local = getLocal<StudyPlan>('study_plans');
    const filtered = local.filter(p => p.id !== id);
    setLocal('study_plans', filtered);
    return true;
  }
};
