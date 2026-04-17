/**
 * Simple in-memory cache for service calls to prevent redundant database queries.
 */
const cache = new Map();

/**
 * Get data from cache or fetch it if not present/expired.
 * @param {string} key Unique key for the cache entry.
 * @param {Function} fetchFn Function that returns a promise with the data.
 * @param {number} ttl Time to live in milliseconds (default 5 minutes).
 */
export async function withCache(key, fetchFn, ttl = 300000) {
    const now = Date.now();
    const entry = cache.get(key);

    if (entry && (now - entry.timestamp < ttl)) {
        return entry.data;
    }

    const data = await fetchFn();
    cache.set(key, { data, timestamp: now });
    return data;
}

/**
 * Clear a specific cache entry (e.g. after a mutation).
 */
export function invalidateCache(key) {
    cache.delete(key);
}

/**
 * Clear all cache entries.
 */
export function clearCache() {
    cache.clear();
}
