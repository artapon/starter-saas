/**
 * Add the `saleType` column to Orders (cash vs credit sale).
 *
 * Fresh databases get it from `sequelize.sync()` (defined as an ENUM on the
 * model); this idempotent migration adds it to existing ones. Stored as a plain
 * STRING here to avoid SQLite ALTER-TABLE CHECK-constraint issues — the model's
 * ENUM still governs accepted values at the application layer. Existing rows
 * backfill to 'credit', preserving the prior SO → DO → Invoice behaviour.
 */
const TABLE = 'Orders'

module.exports = {
  async up(ctx) {
    await ctx.addColumn(TABLE, 'saleType', {
      type: ctx.DataTypes.STRING,
      allowNull: false,
      defaultValue: 'credit',
    })
  },

  async down(ctx) {
    await ctx.removeColumn(TABLE, 'saleType')
  },
}
