const { Router } = require('express')
const { Op } = require('sequelize')
const { authenticate } = require('../../../../server/middleware/auth')
const { requirePermission } = require('../../../../server/middleware/permission')
const MasterDataCategory = require('../models/master-data-category.model')
const MasterDataValue    = require('../models/master-data-value.model')

const router = Router()
router.use(authenticate)

// ── Categories ────────────────────────────────────────────────────────────────

// GET /categories — list all categories with value count
router.get('/categories', requirePermission('erp.stock.list'), async (req, res, next) => {
  try {
    const orgId = req.user?.organizationId || req.user?.id
    const categories = await MasterDataCategory.findAll({
      where: { organizationId: orgId || null, dataFlag: { [Op.ne]: 2 } },
      include: [{ model: MasterDataValue, as: 'values', attributes: ['id'] }],
      order: [['name', 'DESC']],
    })
    const result = categories.map(c => ({
      ...c.toJSON(),
      valuesCount: c.values?.length ?? 0,
      values: undefined,
    }))
    res.json({ data: { categories: result } })
  } catch (err) { next(err) }
})

// POST /categories — create
router.post('/categories', requirePermission('erp.stock.edit'), async (req, res, next) => {
  try {
    const { slug, name, description } = req.body
    if (!slug?.trim()) return res.status(400).json({ message: 'Slug is required' })
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' })
    const orgId = req.user?.organizationId || req.user?.id
    const category = await MasterDataCategory.create({
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      description: description?.trim() || null,
      organizationId: orgId || null,
      createdBy: req.user?.id || null,
      modifiedBy: req.user?.id || null,
    })
    res.status(201).json({ data: { category } })
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'A category with this code already exists' })
    }
    next(err)
  }
})

// GET /categories/:id — get by ID with values
router.get('/categories/:id', requirePermission('erp.stock.list'), async (req, res, next) => {
  try {
    const category = await MasterDataCategory.findByPk(req.params.id, {
      include: [{ model: MasterDataValue, as: 'values', order: [['sortOrder', 'ASC'], ['name', 'ASC']] }],
    })
    if (!category) return res.status(404).json({ message: 'Category not found' })
    const data = category.toJSON()
    data.values = (data.values || []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    res.json({ data: { category: { ...data, values: undefined }, values: data.values } })
  } catch (err) { next(err) }
})

// PUT /categories/:id — update
router.put('/categories/:id', requirePermission('erp.stock.edit'), async (req, res, next) => {
  try {
    const category = await MasterDataCategory.findByPk(req.params.id)
    if (!category) return res.status(404).json({ message: 'Category not found' })
    const { name, description } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' })
    await category.update({ name: name.trim(), description: description?.trim() || null, modifiedBy: req.user?.id || null })
    res.json({ data: { category } })
  } catch (err) { next(err) }
})

// DELETE /categories/:id — delete (and cascade values)
router.delete('/categories/:id', requirePermission('erp.stock.edit'), async (req, res, next) => {
  try {
    const category = await MasterDataCategory.findByPk(req.params.id)
    if (!category) return res.status(404).json({ message: 'Category not found' })
    if (category.isSystem) return res.status(403).json({ message: 'Cannot delete a system category' })
    await MasterDataValue.destroy({ where: { categoryId: req.params.id } })
    await category.destroy()
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Values ────────────────────────────────────────────────────────────────────

// POST /categories/:id/values — add value
router.post('/categories/:id/values', requirePermission('erp.stock.edit'), async (req, res, next) => {
  try {
    const category = await MasterDataCategory.findByPk(req.params.id)
    if (!category) return res.status(404).json({ message: 'Category not found' })
    const { code, name, description, dataValue, sortOrder, isActive } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' })
    const orgId = req.user?.organizationId || req.user?.id
    const value = await MasterDataValue.create({
      categoryId:     req.params.id,
      code:           code?.trim() || null,
      name:           name.trim(),
      description:    description?.trim() || null,
      dataValue:      dataValue?.toString().trim() || null,
      sortOrder:      sortOrder ?? 0,
      isActive:       isActive !== false,
      organizationId: orgId || null,
      createdBy:      req.user?.id || null,
      modifiedBy:     req.user?.id || null,
    })
    res.status(201).json({ data: { value } })
  } catch (err) { next(err) }
})

// PUT /values/:id — update value
router.put('/values/:id', requirePermission('erp.stock.edit'), async (req, res, next) => {
  try {
    const value = await MasterDataValue.findByPk(req.params.id)
    if (!value) return res.status(404).json({ message: 'Value not found' })
    const { code, name, description, dataValue, sortOrder, isActive } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' })
    await value.update({
      code:        code?.trim() || null,
      name:        name.trim(),
      description: description?.trim() || null,
      dataValue:   dataValue?.toString().trim() || null,
      sortOrder:   sortOrder ?? 0,
      isActive:    isActive !== false,
      modifiedBy:  req.user?.id || null,
    })
    res.json({ data: { value } })
  } catch (err) { next(err) }
})

// DELETE /values/:id — delete value
router.delete('/values/:id', requirePermission('erp.stock.edit'), async (req, res, next) => {
  try {
    const value = await MasterDataValue.findByPk(req.params.id)
    if (!value) return res.status(404).json({ message: 'Value not found' })
    await value.destroy()
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// GET /by-name/:name — get active values by category display name (used by form dropdowns)
router.get('/by-name/:name', requirePermission('erp.stock.list'), async (req, res, next) => {
  try {
    const orgId = req.user?.organizationId || req.user?.id
    const byName = (organizationId) => MasterDataCategory.findOne({
      where: { name: req.params.name, organizationId, dataFlag: { [Op.ne]: 2 } },
      include: [{
        model: MasterDataValue,
        as: 'values',
        where: { isActive: true, dataFlag: { [Op.ne]: 2 } },
        required: false,
      }],
    })
    // Prefer an org-specific category; fall back to the global (system) one.
    const category = (await byName(orgId || null)) || (orgId ? await byName(null) : null)
    if (!category) return res.json({ data: { values: [] } })
    const values = (category.values || []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    res.json({ data: { values } })
  } catch (err) { next(err) }
})

// ── Slug lookup (must be last to avoid shadowing /categories) ─────────────────

// GET /:slug — get active values by category slug (used by form dropdowns)
router.get('/:slug', requirePermission('erp.stock.list'), async (req, res, next) => {
  try {
    const orgId = req.user?.organizationId || req.user?.id
    const bySlug = (organizationId) => MasterDataCategory.findOne({
      where: { slug: req.params.slug, organizationId, dataFlag: { [Op.ne]: 2 } },
      include: [{
        model: MasterDataValue,
        as: 'values',
        where: { isActive: true, dataFlag: { [Op.ne]: 2 } },
        required: false,
        order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      }],
    })
    // Prefer an org-specific category; fall back to the global (system) one
    // seeded with organizationId = null so shared reference data is visible.
    const category = (await bySlug(orgId || null)) || (orgId ? await bySlug(null) : null)
    if (!category) return res.json({ data: { category: null, values: [] } })
    const values = (category.values || []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    res.json({ data: { category, values } })
  } catch (err) { next(err) }
})

module.exports = { mountPath: '/master-data', router }