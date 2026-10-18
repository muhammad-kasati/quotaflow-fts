/**
 * Returns the current calendar period in UTC formatted as "YYYY-MM"
 */
export function getCurrentUtcPeriod(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns start and end Date objects in UTC for a given period "YYYY-MM"
 */
export function getPeriodRange(period: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  // Next month first day
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

  return { start, end };
}
