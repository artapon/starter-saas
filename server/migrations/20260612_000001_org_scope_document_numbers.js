/**
 * Make document-number columns unique per-organization instead of globally.
 *
 * invoiceNumber / orderNumber / receiptNumber / billNumber / refNo were created
 * with a column-level UNIQUE (global across all tenants). That blocks two
 * organizations from each having e.g. INV-2026-0001 — which breaks the demo-data
 * seed for a second tenant and is wrong for real per-org numbering. Replace the
 * global UNIQUE with a composite UNIQUE on (number, organizationId).
 *
 * SQLite can't drop a column's UNIQUE (it lives in an unnamed autoindex baked
 * into the table), and Sequelize's changeColumn rebuild is unreliable here, so
 * we rebuild the table by hand: rename → recreate from the original CREATE TABLE
 * with the UNIQUE token stripped → copy rows → drop old → recreate the named
 * secondary indexes. Postgres/MySQL just drop the unique index/constraint.
 */
const TARGETS = [
  { table: 'Invoices',      column: 'invoiceNumber', name: 'idx_invoices_number_org' },
  { table: 'quotations',    column: 'refNo',         name: 'idx_quotations_refno_org' },
  { table: 'Receipts',      column: 'receiptNumber', name: 'idx_receipts_number_org' },
  { table: 'Orders',        column: 'orderNumber',   name: 'idx_orders_number_org' },
  { table: 'vendor_bills',  column: 'billNumber',    name: 'idx_vendor_bills_number_org' },
  { table: 'GoodReceives',  column: 'refNo',         name: 'idx_good_receives_refno_org' },
  { table: 'StockAdjusts',  column: 'refNo',         name: 'idx_stock_adjusts_refno_org' },
  { table: 'StockCounts',   column: 'refNo',         name: 'idx_stock_counts_refno_org' },
  { table: 'StockIssues',   column: 'refNo',         name: 'idx_stock_issues_refno_org' },
  { table: 'StockRequests', column: 'refNo',         name: 'idx_stock_requests_refno_org' },
  { table: 'StockReturns',  column: 'refNo',         name: 'idx_stock_returns_refno_org' },
]

// Rebuild a SQLite table to drop the single column-level UNIQUE on `column`.
async function sqliteDropColumnUnique(sequelize, table, column) {
  const [[tbl]] = [await sequelize.query(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name = :t`, { replacements: { t: table } },
  )]
  const createSql = tbl[0] && tbl[0].sql
  if (!createSql || !/UNIQUE/i.test(createSql)) return // already migrated / no global unique

  // Named secondary indexes to recreate after the rebuild (autoindexes have sql=NULL).
  const [secondary] = await sequelize.query(
    `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name = :t AND sql IS NOT NULL`,
    { replacements: { t: table } },
  )

  // Strip the column's UNIQUE. These tables carry exactly one column-level UNIQUE
  // (the document number); the PK uses PRIMARY KEY, not UNIQUE.
  const newCreate = createSql.replace(/\s+UNIQUE/gi, '')

  // Pin everything to one connection: PRAGMA foreign_keys can't be changed inside
  // a transaction and is connection-scoped, so the rebuild can't share a pooled
  // connection with a different FK setting.
  const conn = await sequelize.connectionManager.getConnection()
  const run = (sql) => sequelize.query(sql, { type: sequelize.QueryTypes.RAW, raw: true, connection: conn })
  try {
    // foreign_keys=OFF so copying rows doesn't trip FKs; legacy_alter_table=ON so
    // RENAME doesn't rewrite child tables' FK references to point at the temp name.
    await run('PRAGMA foreign_keys=OFF')
    await run('PRAGMA legacy_alter_table=ON')
    await run('BEGIN')
    try {
      await run(`ALTER TABLE \`${table}\` RENAME TO \`${table}__old\``)
      await run(newCreate)
      await run(`INSERT INTO \`${table}\` SELECT * FROM \`${table}__old\``)
      await run(`DROP TABLE \`${table}__old\``)
      for (const idx of secondary) if (idx.sql) await run(idx.sql)
      await run('COMMIT')
    } catch (err) {
      await run('ROLLBACK')
      throw err
    }
    await run('PRAGMA legacy_alter_table=OFF')
    await run('PRAGMA foreign_keys=ON')
  } finally {
    await sequelize.connectionManager.releaseConnection(conn)
  }
}

module.exports = {
  async up(ctx) {
    const dialect = ctx.sequelize.getDialect()
    for (const { table, column, name } of TARGETS) {
      if (!(await ctx.tableExists(table))) continue
      if (!(await ctx.columnExists(table, column))) continue

      if (dialect === 'sqlite') {
        await sqliteDropColumnUnique(ctx.sequelize, table, column)
      } else {
        // Postgres/MySQL: drop the auto-named unique index/constraint (best effort).
        await ctx.removeIndex(table, [column])
        try { await ctx.queryInterface.removeConstraint(table, `${table}_${column}_key`) } catch { /* none */ }
      }

      // Add the per-organization composite unique.
      await ctx.addIndex(table, [column, 'organizationId'], { unique: true, name })
    }
  },

  async down(ctx) {
    for (const { table, name } of TARGETS) {
      await ctx.removeIndex(table, name)
    }
  },
}
