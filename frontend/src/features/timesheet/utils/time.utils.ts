/**
 * Pad number to 2 digits
 */
export const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Normalize time string to HH:00 format (only hours, minutes always :00)
 */
export const normalizeTime = (t: string | undefined, fallback = '08:00'): string => {
  const s = (t ? String(t) : fallback).slice(0, 5);
  const [h = '08'] = s.split(':');
  const hh = pad2(Math.max(0, Math.min(23, Number.isFinite(+h) ? +h : 8)));
  
  // ✅ Minutele sunt mereu :00
  return `${hh}:00`;
};

/**
 * Convert time string to hours (minutes are always 0)
 */
export const toHours = (t: string): number => {
  const [h] = normalizeTime(t).split(':');
  return Number(h);
};

/**
 * Calculate work hours between start and end time
 * Handles overnight shifts (end <= start means next day)
 * Returns hours only (no minutes)
 */
export const calcWorkHours = (start: string, end: string): number => {
  const s = toHours(start);
  let e = toHours(end);
  if (e <= s) e += 24; // Next day
  return Math.max(0, e - s);
};

/**
 * @deprecated Use calcWorkHours instead. Kept for backward compatibility.
 */
export const calcWorkMinutes = (start: string, end: string): number => {
  return calcWorkHours(start, end) * 60;
};

/**
 * @deprecated Use toHours instead. Kept for backward compatibility.
 */
export const toMinutes = (t: string): number => {
  return toHours(t) * 60;
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


