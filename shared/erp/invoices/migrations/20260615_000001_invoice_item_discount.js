const TABLE = 'invoice_items'

module.exports = {
  async up(ctx) {
    await ctx.addColumn(TABLE, 'discountValue', {
      type: ctx.DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    })
    await ctx.addColumn(TABLE, 'discountAmount', {
      type: ctx.DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    })
  },

  async down(ctx) {
    await ctx.removeColumn(TABLE, 'discountValue')
    await ctx.removeColumn(TABLE, 'discountAmount')
  },
}
