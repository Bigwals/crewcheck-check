interface CachedToken {
    token:     string;
    expiresAt: number;  // epoch ms
}

const cache = new Map<string, CachedToken>();

export const getCachedToken = (userId: string): string | null => {
    const entry = cache.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(userId);
        return null;
    }
    return entry.token;
};

export const setCachedToken = (userId: string, token: string, ttlMinutes = 25): void => {
    cache.set(userId, {
        token,
        expiresAt: Date.now() + ttlMinutes * 60 * 1000
    });
};

export const clearCachedToken = (userId: string): void => {
    cache.delete(userId);
};