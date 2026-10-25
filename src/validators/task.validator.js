const { z } = require('zod');

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['pending', 'in-progress', 'completed'];

// Friendly "is required" vs "wrong type" messages
const typeError = (field, type) => (issue) =>
  issue.input === undefined ? `${field} is required` : `${field} must be ${type}`;

// Rules for each field (no defaults here, so PATCH can reuse them)
const fields = {
  title: z
    .string({ error: typeError('title', 'text') })
    .trim()
    .min(3, 'title must have at least 3 characters')
    .max(100, 'title must be at most 100 characters'),
  description: z
    .string({ error: typeError('description', 'text') })
    .trim()
    .max(500, 'description must be at most 500 characters'),
  subject: z
    .string({ error: typeError('subject', 'text') })
    .trim()
    .min(2, 'subject must have at least 2 characters')
    .max(50, 'subject must be at most 50 characters'),
  priority: z.enum(PRIORITIES, { error: `priority must be one of: ${PRIORITIES.join(', ')}` }),
  status: z.enum(STATUSES, { error: `status must be one of: ${STATUSES.join(', ')}` }),
  // "2026-11-01", or empty / null for "no due date"
  due_date: z
    .union([z.iso.date({ error: 'due_date must be a date in YYYY-MM-DD format' }), z.literal(''), z.null()])
    .transform((value) => value || null),
};

// POST and PUT: full task; optional fields fall back to defaults
const taskSchema = z.object({
  title: fields.title,
  description: fields.description.default(''),
  subject: fields.subject.default('General'),
  priority: fields.priority.default('medium'),
  status: fields.status.default('pending'),
  due_date: fields.due_date.default(null),
});

// PATCH: any subset of fields, but at least one
const patchSchema = z
  .object(fields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

const idParamSchema = z.object({
  id: z.coerce
    .number({ error: 'id must be a number' })
    .int('id must be a whole number')
    .positive('id must be a positive number'),
});

// GET /tasks?status=pending&priority=high&search=dbms
const listQuerySchema = z.object({
  status: fields.status.optional(),
  priority: fields.priority.optional(),
  search: z.string().trim().max(100, 'search must be at most 100 characters').optional(),
});

module.exports = { taskSchema, patchSchema, idParamSchema, listQuerySchema };
