const TABLE = 'sales_order_items'

module.exports = {
  async up(ctx) {
    await ctx.addColumn(TABLE, 'discountType', {
      type: ctx.DataTypes.STRING,
      allowNull: false,
      defaultValue: 'percent',
    })
    // Widen the line discount so a fixed (amount) discount isn't capped at
    // 999.99. SQLite's column types are advisory, so only the rigid engines
    // need the ALTER; the helper context lacks changeColumn, so call it via
    // the query interface, guarded by columnExists.
    if (ctx.sequelize.getDialect() !== 'sqlite' && await ctx.columnExists(TABLE, 'discountValue')) {
      await ctx.queryInterface.changeColumn(TABLE, 'discountValue', {
        type: ctx.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      })
    }
  },

  async down(ctx) {
    await ctx.removeColumn(TABLE, 'discountType')
    if (ctx.sequelize.getDialect() !== 'sqlite' && await ctx.columnExists(TABLE, 'discountValue')) {
      await ctx.queryInterface.changeColumn(TABLE, 'discountValue', {
        type: ctx.DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      })
    }
  },
}
