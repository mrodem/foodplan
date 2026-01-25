import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  let d: Date;
  if (typeof date === 'string') {
    // Parse date string as local time (not UTC) to avoid timezone shifts
    const [year, month, day] = date.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = date;
  }
  return d.toLocaleDateString('nb-NO', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getWeekDates(baseDate: Date = new Date()): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();
  const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start

  const monday = new Date(baseDate);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }

  return dates;
}

export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {} as Record<K, T[]>);
}
