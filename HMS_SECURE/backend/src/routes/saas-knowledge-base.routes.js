const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission, allowRoles } = require('../middleware/auth');
const { KnowledgeBaseArticle, AuditLog } = require('../models');

const router = express.Router();
const VALID_STATUS = new Set(['draft', 'published', 'archived']);
const VALID_VISIBILITY = new Set(['public', 'tenant_admin', 'internal']);

function normalizeArticlePayload(body = {}, existing = {}) {
  const title = body.title !== undefined ? String(body.title || '').trim() : existing.title;
  const slug = body.slug !== undefined
    ? String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    : existing.slug;
  const tags = Array.isArray(body.tags)
    ? body.tags.map((x) => String(x).trim()).filter(Boolean)
    : typeof body.tags === 'string'
      ? body.tags.split(',').map((x) => x.trim()).filter(Boolean)
      : existing.tags;
  return {
    title,
    slug: slug || (title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : existing.slug),
    summary: body.summary !== undefined ? String(body.summary || '').trim() : existing.summary,
    body: body.body !== undefined ? String(body.body || '').trim() : existing.body,
    category: body.category !== undefined ? String(body.category || 'general').trim() : existing.category,
    audience: body.audience !== undefined ? String(body.audience || 'tenant_admin').trim() : existing.audience,
    visibility: body.visibility !== undefined && VALID_VISIBILITY.has(body.visibility) ? body.visibility : (existing.visibility || 'tenant_admin'),
    status: body.status !== undefined && VALID_STATUS.has(body.status) ? body.status : (existing.status || 'draft'),
    tags,
    related_ticket_category: body.related_ticket_category !== undefined ? String(body.related_ticket_category || '').trim() : existing.related_ticket_category,
    display_order: body.display_order !== undefined ? Number(body.display_order || 0) : existing.display_order,
  };
}

async function audit(req, action, details = {}) {
  try {
    await AuditLog.create({
      hospital_id: Number(req.user?.hospital_id || 1),
      user_id: req.user?.id,
      action,
      module: 'saas_knowledge_base',
      details,
      ip: req.ip,
      user_agent: req.get('user-agent'),
    });
  } catch (_err) {}
}

router.get('/saas/knowledge-base/public', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();
  const filter = { status: 'published', visibility: { $in: ['public', 'tenant_admin'] } };
  if (category) filter.category = category;
  if (q) filter.$or = [
    { title: new RegExp(q, 'i') },
    { summary: new RegExp(q, 'i') },
    { body: new RegExp(q, 'i') },
    { tags: new RegExp(q, 'i') },
  ];
  const articles = await KnowledgeBaseArticle.find(filter)
    .sort({ display_order: 1, updated_at: -1 })
    .limit(100)
    .lean();
  res.json(articles.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    summary: a.summary,
    category: a.category,
    audience: a.audience,
    tags: a.tags || [],
    updated_at: a.updated_at,
  })));
}));

router.get('/saas/knowledge-base/public/:slug', asyncHandler(async (req, res) => {
  const article = await KnowledgeBaseArticle.findOne({ slug: req.params.slug, status: 'published', visibility: { $in: ['public', 'tenant_admin'] } }).lean();
  if (!article) return res.status(404).json({ message: 'Knowledge article not found' });
  await KnowledgeBaseArticle.updateOne({ id: article.id }, { $inc: { view_count: 1 }, last_viewed_at: new Date() });
  res.json(article);
}));

router.get('/saas/knowledge-base', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const status = String(req.query.status || '').trim();
  const category = String(req.query.category || '').trim();
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  const articles = await KnowledgeBaseArticle.find(filter).sort({ updated_at: -1 }).limit(200).lean();
  res.json(articles);
}));

router.post('/saas/knowledge-base', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const payload = normalizeArticlePayload(req.body);
  if (!payload.title) return res.status(400).json({ message: 'title is required' });
  if (!payload.body) return res.status(400).json({ message: 'body is required' });
  if (!payload.slug) return res.status(400).json({ message: 'slug is required' });
  const existing = await KnowledgeBaseArticle.findOne({ slug: payload.slug });
  if (existing) return res.status(409).json({ message: 'Article slug already exists' });
  const article = await KnowledgeBaseArticle.create({ ...payload, created_by: req.user?.id, published_at: payload.status === 'published' ? new Date() : undefined });
  await audit(req, 'knowledge_article_created', { article_id: article.id, slug: article.slug, status: article.status });
  res.status(201).json(article);
}));

router.patch('/saas/knowledge-base/:id', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const article = await KnowledgeBaseArticle.findOne({ id: Number(req.params.id) });
  if (!article) return res.status(404).json({ message: 'Knowledge article not found' });
  const payload = normalizeArticlePayload(req.body, article.toObject());
  if (!payload.title) return res.status(400).json({ message: 'title is required' });
  if (!payload.body) return res.status(400).json({ message: 'body is required' });
  if (payload.slug && payload.slug !== article.slug) {
    const duplicate = await KnowledgeBaseArticle.findOne({ slug: payload.slug, id: { $ne: article.id } });
    if (duplicate) return res.status(409).json({ message: 'Article slug already exists' });
  }
  Object.assign(article, payload, { updated_by: req.user?.id });
  if (article.status === 'published' && !article.published_at) article.published_at = new Date();
  if (article.status !== 'published') article.published_at = undefined;
  await article.save();
  await audit(req, 'knowledge_article_updated', { article_id: article.id, slug: article.slug, status: article.status });
  res.json(article);
}));

router.post('/saas/knowledge-base/:id/publish', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const article = await KnowledgeBaseArticle.findOne({ id: Number(req.params.id) });
  if (!article) return res.status(404).json({ message: 'Knowledge article not found' });
  article.status = 'published';
  article.published_at = new Date();
  article.updated_by = req.user?.id;
  await article.save();
  await audit(req, 'knowledge_article_published', { article_id: article.id, slug: article.slug });
  res.json(article);
}));

router.post('/saas/knowledge-base/:id/archive', verifyToken, allowRoles('super_admin'), requirePermission('hospital.manage'), asyncHandler(async (req, res) => {
  const article = await KnowledgeBaseArticle.findOne({ id: Number(req.params.id) });
  if (!article) return res.status(404).json({ message: 'Knowledge article not found' });
  article.status = 'archived';
  article.updated_by = req.user?.id;
  await article.save();
  await audit(req, 'knowledge_article_archived', { article_id: article.id, slug: article.slug });
  res.json(article);
}));

module.exports = router;
