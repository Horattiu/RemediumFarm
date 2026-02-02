/**
 * Pad number to 2 digits
 */
export const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Normalize time string to HH:mm format
 */
export const normalizeTime = (t: string | undefined, fallback = '08:00'): string => {
  const s = (t ? String(t) : fallback).slice(0, 5);
  const [h = '08', m = '00'] = s.split(':');
  const hh = pad2(Number.isFinite(+h) ? +h : 8);
  const mm = pad2(Number.isFinite(+m) ? +m : 0);
  
  const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
  const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));
  
  return `${HOURS.includes(hh) ? hh : '08'}:${MINUTES.includes(mm) ? mm : '00'}`;
};

/**
 * Convert time string to minutes
 */
export const toMinutes = (t: string): number => {
  const [h, m] = normalizeTime(t).split(':');
  return Number(h) * 60 + Number(m);
};

/**
 * Calculate work minutes between start and end time
 * Handles overnight shifts (end <= start means next day)
 */
export const calcWorkMinutes = (start: string, end: string): number => {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 1440; // Next day
  return Math.max(0, e - s);
};

/**
 * Format minutes to HH:mm
 */
export const formatHM = (mins: number): string => {
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
};

/**
 * Convert hours to minutes
 */
export const hoursToMinutes = (hours: number): number => {
  return Math.round(hours * 60);
};

/**
 * Convert minutes to hours (rounded to 2 decimals)
 */
export const minutesToHours = (minutes: number): number => {
  return Math.round((minutes / 60) * 100) / 100;
};


