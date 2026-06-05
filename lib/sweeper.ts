import { db, CalendarEvent, Task } from './db';

export interface DeadlineAlert {
  id: string;
  title: string;
  type: 'exam' | 'assignment';
  daysLeft: number;
  date: string;
}

/**
 * Scans upcoming calendar events.
 * If an exam or assignment is within 3 days, it:
 * 1. Returns a list of active alerts to display on the dashboard.
 * 2. Automatically inserts a high-priority (Urgent & Important) task in the Task Manager if not already present.
 */
export async function runDeadlineSweeper(): Promise<DeadlineAlert[]> {
  try {
    const events = await db.getEvents();
    const tasks = await db.getTasks();
    const today = new Date();
    
    const activeAlerts: DeadlineAlert[] = [];

    const examOrAssignments = events.filter(
      e => (e.type === 'exam' || e.type === 'assignment') && new Date(e.start_time) >= today
    );

    for (const event of examOrAssignments) {
      const eventDate = new Date(event.start_time);
      const diffTime = eventDate.getTime() - today.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      // Trigger threshold: within 3 days (0 to 3 days)
      if (diffDays <= 3 && diffDays >= 0) {
        const daysLeft = Math.ceil(diffDays);
        
        // Add to active alerts
        activeAlerts.push({
          id: event.id,
          title: event.title,
          type: event.type as 'exam' | 'assignment',
          daysLeft,
          date: event.start_time
        });

        // Determine target task title
        const taskTitle = event.type === 'exam'
          ? `Study: Prepare for ${event.title}`
          : `Task: Submit ${event.title}`;

        // Check if task already exists
        const taskExists = tasks.some(
          t => t.title.toLowerCase() === taskTitle.toLowerCase()
        );

        if (!taskExists) {
          // Auto-insert task into Eisenhower matrix (Urgent & Important!)
          await db.addTask({
            title: taskTitle,
            completed: false,
            due_date: event.start_time,
            priority: 'urgent_important',
            pomodoro_count: 0
          });
        }
      }
    }

    return activeAlerts;
  } catch (err) {
    console.error('Error in deadline sweeper:', err);
    return [];
  }
}
