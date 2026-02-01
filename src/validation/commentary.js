import { z } from 'zod';

/**
 * Schema for validating commentary list queries.
 * Includes an optional limit that is coerced to a number, must be positive, and at most 100.
 */
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional()
});

/**
 * Schema for validating the creation of a commentary entry.
 * Includes fields for minute, sequence, period, event types, actors, teams, and the message itself.
 */
export const createCommentarySchema = z.object({
  minute: z.number().int().nonnegative().optional(),
  sequence: z.number().int().optional(),
  period: z.string().optional(),
  eventType: z.string().optional(),
  actor: z.string().optional(),
  team: z.string().optional(),
  message: z.string().min(1),
  metadata: z.any().optional(),
  tags: z.array(z.string()).optional()
});
