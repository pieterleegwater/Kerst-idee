// Opslag van spellen. In productie Cloudflare D1 (gratis SQLite), in tests een Map.

export function d1Store(db) {
  return {
    async get(id) {
      const row = await db.prepare("SELECT data FROM games WHERE id = ?").bind(id).first();
      return row ? JSON.parse(row.data) : null;
    },
    async put(record) {
      await db
        .prepare("INSERT INTO games (id, created_at, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data")
        .bind(record.id, record.createdAt, JSON.stringify(record))
        .run();
    },
    async deleteOlderThan(iso) {
      await db.prepare("DELETE FROM games WHERE created_at < ?").bind(iso).run();
    },
  };
}

export function memoryStore() {
  const map = new Map();
  return {
    async get(id) {
      return map.has(id) ? structuredClone(map.get(id)) : null;
    },
    async put(record) {
      map.set(record.id, structuredClone(record));
    },
    async deleteOlderThan(iso) {
      for (const [id, r] of map) if (r.createdAt < iso) map.delete(id);
    },
  };
}
