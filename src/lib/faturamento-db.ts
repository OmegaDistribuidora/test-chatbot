import { Pool } from "pg";

type FaturamentoFilters = {
  date?: string;
  startDate?: string;
  endDate?: string;
  codfilial?: number[];
  codfornec?: number[];
};

type FaturamentoQueryResult = {
  totalFaturamento: number;
  totalRegistros: number;
  dataMin: string | null;
  dataMax: string | null;
  valorColumn: string;
};

const globalForPg = globalThis as unknown as { faturamentoPool?: Pool };

function createPool() {
  return new Pool({
    host: process.env.FAT_DB_HOST ?? "192.168.1.14",
    port: Number(process.env.FAT_DB_PORT ?? "5432"),
    database: process.env.FAT_DB_NAME ?? "Omega",
    user: process.env.FAT_DB_USER ?? "omegacomercial",
    password: process.env.FAT_DB_PASSWORD ?? "omega",
    max: Number(process.env.FAT_DB_MAX_CONNECTIONS ?? "10"),
    idleTimeoutMillis: 30_000,
  });
}

const pool = globalForPg.faturamentoPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalForPg.faturamentoPool = pool;
}

const preferredValueColumns = [
  "faturamento",
  "faturamentotab",
  "lucro",
  "lucrotab",
  "vlrfat",
  "vlr_fat",
  "vlrtotal",
  "valor_total",
  "valortotal",
  "vltotal",
  "valor",
];

let cachedValueColumnName: string | null = null;

function assertSafeColumnName(columnName: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
    throw new Error(`Nome de coluna invalido: ${columnName}`);
  }
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

async function getFaturamentoValueColumn() {
  if (cachedValueColumnName) {
    return cachedValueColumnName;
  }

  const configuredColumn = process.env.FATURAMENTO_VALOR_COLUMN;
  if (configuredColumn) {
    assertSafeColumnName(configuredColumn);
    cachedValueColumnName = configuredColumn;
    return configuredColumn;
  }

  const columnsQuery = await pool.query<{
    column_name: string;
    data_type: string;
  }>(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'fato'
      AND table_name = 'ffaturamento'
  `);

  const byName = new Set(columnsQuery.rows.map((row) => row.column_name));
  for (const preferred of preferredValueColumns) {
    if (byName.has(preferred)) {
      cachedValueColumnName = preferred;
      return preferred;
    }
  }

  const availableColumns = columnsQuery.rows.map((row) => row.column_name).join(", ");
  throw new Error(
    `Nao foi possivel detectar a coluna de valor do faturamento em fato.ffaturamento. Defina FATURAMENTO_VALOR_COLUMN. Colunas encontradas: ${availableColumns}`,
  );
}

function addDateConditions(
  whereClauses: string[],
  values: unknown[],
  filters: FaturamentoFilters,
) {
  if (filters.date) {
    values.push(filters.date);
    const startIndex = values.length;
    values.push(filters.date);
    const endIndex = values.length;
    whereClauses.push(
      `dtmov >= $${startIndex}::date AND dtmov < ($${endIndex}::date + interval '1 day')`,
    );
    return;
  }

  if (filters.startDate || filters.endDate) {
    const startDate = filters.startDate ?? filters.endDate;
    const endDate = filters.endDate ?? filters.startDate;

    if (!startDate || !endDate) {
      throw new Error("Informe um intervalo de data valido.");
    }

    if (startDate > endDate) {
      throw new Error("A data inicial nao pode ser maior que a data final.");
    }

    values.push(startDate);
    const startIndex = values.length;
    values.push(endDate);
    const endIndex = values.length;

    whereClauses.push(
      `dtmov >= $${startIndex}::date AND dtmov < ($${endIndex}::date + interval '1 day')`,
    );
    return;
  }

  whereClauses.push(
    "dtmov >= date_trunc('year', current_date) AND dtmov < date_trunc('year', current_date) + interval '1 year'",
  );
}

export async function queryFaturamentoTotal(filters: FaturamentoFilters) {
  const valueColumn = await getFaturamentoValueColumn();
  assertSafeColumnName(valueColumn);

  const whereClauses: string[] = [];
  const values: unknown[] = [];

  addDateConditions(whereClauses, values, filters);

  if (filters.codfilial && filters.codfilial.length > 0) {
    values.push(filters.codfilial.map(String));
    whereClauses.push(`codfilial::text = ANY($${values.length}::text[])`);
  }

  if (filters.codfornec && filters.codfornec.length > 0) {
    values.push(filters.codfornec.map(String));
    whereClauses.push(`codfornec::text = ANY($${values.length}::text[])`);
  }

  const sql = `
    SELECT
      COALESCE(SUM(${quoteIdentifier(valueColumn)}), 0)::double precision AS total_faturamento,
      COUNT(*)::int AS total_registros,
      to_char(MIN(dtmov)::date, 'YYYY-MM-DD') AS data_min,
      to_char(MAX(dtmov)::date, 'YYYY-MM-DD') AS data_max
    FROM fato.ffaturamento
    WHERE ${whereClauses.join(" AND ")}
  `;

  const result = await pool.query<{
    total_faturamento: number;
    total_registros: number;
    data_min: string | null;
    data_max: string | null;
  }>(sql, values);

  const row = result.rows[0];

  return {
    totalFaturamento: Number(row?.total_faturamento ?? 0),
    totalRegistros: Number(row?.total_registros ?? 0),
    dataMin: row?.data_min ?? null,
    dataMax: row?.data_max ?? null,
    valorColumn: valueColumn,
  } satisfies FaturamentoQueryResult;
}
