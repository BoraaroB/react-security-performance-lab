import type { RefreshTokenRecord, RefreshTokenStore } from './core.js';

export type MemoryRefreshTokenStore = RefreshTokenStore & {
  /** Removes every record (e.g. between tests). */
  clear(): void;
};

/**
 * Keeps records in a Map in this process: lost on restart, and not shared between server instances. Fine for
 * development and one-instance demos; use a database or Redis in production.
 */
export function createMemoryRefreshTokenStore(): MemoryRefreshTokenStore {
  const records = new Map<string, RefreshTokenRecord>();

  return {
    // Copies in and out, so a caller changing an object cannot change the stored record by accident.
    async save(record) {
      records.set(record.tokenHash, { ...record });
    },

    async find(tokenHash) {
      const record = records.get(tokenHash);
      return record && { ...record };
    },

    // Atomic because there is no `await` between the check and the update: JavaScript runs this to the end before
    // any other request's code.
    async markUsed(tokenHash, usedAt) {
      const record = records.get(tokenHash);
      if (!record || record.usedAt !== null) return false;
      record.usedAt = usedAt;
      return true;
    },

    // A scan over all records: fine for a demo. A database would use an index on the family ID.
    async deleteFamily(familyId) {
      for (const [tokenHash, record] of records) {
        if (record.familyId === familyId) records.delete(tokenHash);
      }
    },

    clear() {
      records.clear();
    },
  };
}
