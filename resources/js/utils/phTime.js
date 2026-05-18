/**
 * Philippine Time Utilities (Asia/Manila, UTC+8)
 * Usage: import { nowPH, formatPHDate, formatPHTime, formatPHDateTime } from '@/utils/phTime';
 */

const PH_LOCALE = 'en-PH';
const PH_TZ    = 'Asia/Manila';

// ─── Raw helpers ────────────────────────────────────────────────────────────

/** Returns the current moment as a Date object (JS Date is always UTC internally). */
export const nowPH = () => new Date();

/**
 * Converts any date input to a Date object.
 * Accepts: Date | string | number | null | undefined
 */
export const toDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
};

// ─── Formatters ─────────────────────────────────────────────────────────────

/**
 * "Mar 11, 2026"
 */
export const formatPHDate = (value) => {
    const d = toDate(value);
    if (!d) return '';
    return d.toLocaleDateString(PH_LOCALE, {
        timeZone: PH_TZ,
        year:  'numeric',
        month: 'short',
        day:   'numeric',
    });
};

/**
 * "01:36 PM"
 */
export const formatPHTime = (value) => {
    const d = toDate(value);
    if (!d) return '';
    return d.toLocaleTimeString(PH_LOCALE, {
        timeZone: PH_TZ,
        hour:   '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

/**
 * "Mar 11, 2026 01:36 PM"
 */
export const formatPHDateTime = (value) => {
    const d = toDate(value);
    if (!d) return '';
    return d.toLocaleString(PH_LOCALE, {
        timeZone: PH_TZ,
        year:   'numeric',
        month:  'short',
        day:    'numeric',
        hour:   '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

/**
 * "Tuesday, March 11, 2026"
 */
export const formatPHFullDate = (value) => {
    const d = toDate(value);
    if (!d) return '';
    return d.toLocaleDateString(PH_LOCALE, {
        timeZone: PH_TZ,
        weekday: 'long',
        year:    'numeric',
        month:   'long',
        day:     'numeric',
    });
};

/**
 * "01:36:45 PM" (with seconds)
 */
export const formatPHTimeFull = (value) => {
    const d = toDate(value);
    if (!d) return '';
    return d.toLocaleTimeString(PH_LOCALE, {
        timeZone: PH_TZ,
        hour:   '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
};

/**
 * "2026-03-11" — useful for date inputs and API filters
 */
export const formatPHDateISO = (value) => {
    const d = toDate(value) ?? new Date();
    return new Intl.DateTimeFormat('en-CA', {   // en-CA gives YYYY-MM-DD
        timeZone: PH_TZ,
    }).format(d);
};

/**
 * Returns the current PH date as "YYYY-MM-DD" — useful for today's date filter
 */
export const todayPH = () => formatPHDateISO(new Date());

/**
 * React hook — returns a live PH time string that ticks every second.
 * Usage: const time = usePHClock();
 */
export const usePHClock = () => {
    // Lazy import React so this file works without JSX
    const { useState, useEffect } = require('react');
    const [time, setTime] = useState(() => formatPHTime(new Date()));
    useEffect(() => {
        const id = setInterval(() => setTime(formatPHTime(new Date())), 1000);
        return () => clearInterval(id);
    }, []);
    return time;
};

/**
 * React hook — returns live { date, time, datetime } strings in PH timezone.
 * Usage: const { date, time, datetime } = usePHDateTime();
 */
export const usePHDateTime = () => {
    const { useState, useEffect } = require('react');
    const get = () => ({
        date:     formatPHDate(new Date()),
        time:     formatPHTime(new Date()),
        datetime: formatPHDateTime(new Date()),
    });
    const [val, setVal] = useState(get);
    useEffect(() => {
        const id = setInterval(() => setVal(get()), 1000);
        return () => clearInterval(id);
    }, []);
    return val;
};