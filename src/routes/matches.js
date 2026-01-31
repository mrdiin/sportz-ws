import { desc } from 'drizzle-orm';
import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { db } from '../db/db.js';
import { matches } from '../db/schema.js';
import { getMatchStatus } from '../utils/match-status.js';
import { createMatchSchema, listMatchesQuerySchema } from '../validation/matches.js';

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get('/', async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid query parameters', details: parsed.error.issues });
  }

  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    const events = await db.select().from(matches).limit(limit).orderBy(desc(matches.createdAt));
    res.status(StatusCodes.OK).json({ data: events });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to list matches', details: error.message });
  }
});

matchRouter.post('/', async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid request body', details: parsed.error.issues });
  }

  const {
    data: { startTime, endTime, homeScore, awayScore }
  } = parsed;

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime)
      })
      .returning();

    if (res.app.locals.broadcastMatchCreated) {
      try {
        res.app.locals.broadcastMatchCreated(event);
      } catch (broadcastError) {
        console.error('Failed to broadcast match_created event', broadcastError);
      }
    }

    res.status(StatusCodes.CREATED).json({ data: event });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error', details: error.message });
  }
});
