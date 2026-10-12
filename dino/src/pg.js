// Maakt van een Postgres-pool (Netlify Database / node-postgres) hetzelfde kleine interface als Cloudflare D1,
// zodat src/app.js op beide platformen ongewijzigd draait.
const NUMERIC_TYPES = new Set([20, 1700]); // int8 en numeric komen als tekst terug; wij willen getallen

const toPg = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

function rowsOf(res) {
  const numeric = (res.fields || []).filter((f) => NUMERIC_TYPES.has(f.dataTypeID)).map((f) => f.name);
  return res.rows.map((row) => {
    const out = { ...row };
    for (const k of numeric) if (out[k] != null) out[k] = Number(out[k]);
    return out;
  });
}

// `source` is een pool, of een functie die er (pas bij het eerste gebruik) een geeft.
export function pgDatabase(source) {
  let pool = typeof source === "function" ? null : source;
  const getPool = () => (pool ??= source());
  const exec = (client, sql, args) => client.query(toPg(sql), args);
  const statement = (sql, args = []) => ({
    sql,
    args,
    bind: (...a) => statement(sql, a),
    async first() {
      return rowsOf(await exec(getPool(), sql, args))[0] ?? null;
    },
    async all() {
      return { results: rowsOf(await exec(getPool(), sql, args)) };
    },
    async run() {
      const res = await exec(getPool(), sql, args);
      return { meta: { changes: res.rowCount ?? 0 } };
    },
  });
  return {
    prepare: (sql) => statement(sql),
    // Net als D1: alles of niets, in één transactie; geeft per statement het aantal gewijzigde rijen terug.
    async batch(statements) {
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const s of statements) results.push({ meta: { changes: (await exec(client, s.sql, s.args)).rowCount ?? 0 } });
        await client.query("COMMIT");
        return results;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
