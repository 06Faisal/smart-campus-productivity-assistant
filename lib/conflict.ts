import { CalendarEvent } from './db';

/**
 * Checks if a proposed event overlaps with any existing events in the calendar.
 * Returns an array of conflicting events.
 * 
 * Overlap condition:
 * Two events A and B overlap if: A.start_time < B.end_time AND A.end_time > B.start_time
 */
export function checkEventConflict(
  newEvent: Omit<CalendarEvent, 'id'> | CalendarEvent,
  existingEvents: CalendarEvent[]
): CalendarEvent[] {
  const newStart = new Date(newEvent.start_time).getTime();
  const newEnd = new Date(newEvent.end_time).getTime();

  // Validate times
  if (isNaN(newStart) || isNaN(newEnd) || newStart >= newEnd) {
    return [];
  }

  return existingEvents.filter(existing => {
    // If checking an update, do not conflict with itself
    if ('id' in newEvent && existing.id === newEvent.id) {
      return false;
    }

    const existStart = new Date(existing.start_time).getTime();
    const existEnd = new Date(existing.end_time).getTime();

    if (isNaN(existStart) || isNaN(existEnd) || existStart >= existEnd) {
      return false;
    }

    // Overlap exists if start of new is before end of existing AND end of new is after start of existing
    return newStart < existEnd && newEnd > existStart;
  });
}
