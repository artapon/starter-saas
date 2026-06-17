const TABLE = 'Orders'

module.exports = {
  async up(ctx) {
    await ctx.addColumn(TABLE, 'whtCode', {
      type: ctx.DataTypes.STRING,
      allowNull: true,
    })
    await ctx.addColumn(TABLE, 'whtRate', {
      type: ctx.DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    })
    await ctx.addColumn(TABLE, 'whtAmount', {
      type: ctx.DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    })
  },

  async down(ctx) {
    await ctx.removeColumn(TABLE, 'whtCode')
    await ctx.removeColumn(TABLE, 'whtRate')
    await ctx.removeColumn(TABLE, 'whtAmount')
  },
}
