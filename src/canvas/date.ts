const MADRID_TIME_ZONE = 'Europe/Madrid';

export interface NormalizedDateTime extends Record<string, unknown> {
  raw: string | null;
  localDateTime: string | null;
}

export function toTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function normalizeDateTime(value: string | null | undefined): NormalizedDateTime {
  if (!value) {
    return {
      raw: null,
      localDateTime: null
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      raw: value,
      localDateTime: null
    };
  }

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: MADRID_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    raw: value,
    localDateTime: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  };
}

export function isDateWithinRange(
  value: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  const target = toTimestamp(value);
  if (target === null) {
    return false;
  }

  const fromTs = toTimestamp(from);
  const toTs = toTimestamp(to);

  if (fromTs !== null && target < fromTs) {
    return false;
  }

  if (toTs !== null && target > toTs) {
    return false;
  }

  return true;
}
