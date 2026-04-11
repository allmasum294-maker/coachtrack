import { parse, isValid, parseISO } from 'date-fns';

/**
 * Safely converts a date string or object to a Date object.
 * Handles Firestore timestamps, ISO strings, and standard Date objects.
 */
export function safeToDate(dateVal) {
    if (!dateVal) return null;

    // Handle Firestore Timestamp like objects if any still exist
    if (dateVal.seconds) {
        return new Date(dateVal.seconds * 1000);
    }

    // Handle standard Date object
    if (dateVal instanceof Date) {
        return isValid(dateVal) ? dateVal : null;
    }

    // Handle string (ISO or simple)
    const parsed = parseISO(dateVal);
    if (isValid(parsed)) return parsed;

    const fallback = new Date(dateVal);
    return isValid(fallback) ? fallback : null;
}
