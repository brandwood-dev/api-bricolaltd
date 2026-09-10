export const parseCalendarDate = (input: string | Date): Date => {
  if (input instanceof Date) {
    return new Date(
      input.getFullYear(),
      input.getMonth(),
      input.getDate(),
      0,
      0,
      0,
      0,
    );
  }
  const clean = input.includes('T') ? input.split('T')[0] : input;
  const parts = clean.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${input}`);
  }
  const [y, m, d] = parts.map(Number);
  if ([y, m, d].some(Number.isNaN)) {
    throw new Error(`Invalid date values: ${input}`);
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

export const toCalendarString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const calculateRentalDays = (
  startInput: string | Date,
  endInput: string | Date,
): number => {
  const start = parseCalendarDate(startInput);
  const end = parseCalendarDate(endInput);
  const DAY_MS = 24 * 60 * 60 * 1000;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.max(1, Math.round(diffMs / DAY_MS));
};
