// Kleine D1-nabootsing op node:sqlite, zodat tests de echte SQL en CHECK-constraints gebruiken.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function testDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));

  const statement = (sql, args = []) => ({
    bind: (...a) => statement(sql, a),
    async first() {
      const row = sqlite.prepare(sql).get(...args);
      return row ? { ...row } : null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...args).map((r) => ({ ...r })) };
    },
    async run() {
      const r = sqlite.prepare(sql).run(...args);
      return { meta: { changes: Number(r.changes) } };
    },
    _exec: () => sqlite.prepare(sql).run(...args),
  });

  return {
    sqlite,
    prepare: (sql) => statement(sql),
    async batch(stmts) {
      sqlite.exec("BEGIN");
      try {
        for (const s of stmts) s._exec();
        sqlite.exec("COMMIT");
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
  };
}
