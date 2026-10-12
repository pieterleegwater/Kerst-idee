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
        const results = stmts.map((s) => ({ meta: { changes: Number(s._exec().changes) } }));
        sqlite.exec("COMMIT");
        return results;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
  };
}

// Postgres-variant (PGlite, Postgres in WebAssembly) met hetzelfde schema als Supabase.
import { PGlite } from "@electric-sql/pglite";
import { pgDatabase } from "../src/pg.js";
import { PG_SCHEMA } from "../src/pg-schema.js";

export function testPgDb() {
  const ready = (async () => {
    const pg = new PGlite();
    await pg.exec(PG_SCHEMA);
    await pg.exec(PG_SCHEMA); // tweede keer mag ook (cold starts)
    return pg;
  })();
  const query = async (text, params) => {
    const r = await (await ready).query(text, params);
    return { rows: r.rows, rowCount: r.affectedRows ?? 0, fields: r.fields };
  };
  // PGlite heeft één verbinding; BEGIN/COMMIT werken daar gewoon op.
  return pgDatabase({ query, connect: async () => ({ query, release() {} }) });
}
