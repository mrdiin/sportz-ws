import { desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { db } from '../db/db.js';
import { commentary } from '../db/schema.js';
import { createCommentarySchema, listCommentaryQuerySchema } from '../validation/commentary.js';
import { matchIdParamSchema } from '../validation/matches.js';

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get('/', async (req, res) => {
  try {
    // Validate req.params
    const paramResult = matchIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Invalid request parameters',
        details: paramResult.error.errors
      });
    }
    const { id: matchId } = paramResult.data;

    // Validate req.query
    const queryResult = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Invalid query parameters',
        details: queryResult.error.errors
      });
    }

    const MAX_LIMIT = 100;
    const limit = queryResult.data.limit || 100;
    const finalLimit = Math.min(limit, MAX_LIMIT);

    // Fetch commentary for the given matchId
    const results = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(finalLimit);

    return res.status(StatusCodes.OK).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('Error listing commentary:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

commentaryRouter.post('/', async (req, res) => {
  try {
    // Validate req.params using matchIdParamSchema
    const paramResult = matchIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Invalid request parameters',
        details: paramResult.error.errors
      });
    }
    const { id: matchId } = paramResult.data;

    // Validate req.body using createCommentarySchema
    const bodyResult = createCommentarySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation Error',
        details: bodyResult.error.errors
      });
    }
    const validatedData = bodyResult.data;

    // Insert the data into the commentary table
    const [result] = await db
      .insert(commentary)
      .values({
        matchId,
        ...validatedData,
        // Ensure tags is a string or null for the database
        tags: Array.isArray(validatedData.tags) ? validatedData.tags.join(',') : validatedData.tags || null
      })
      .returning();

    if (req.app.locals.broadcastCommentary) {
      req.app.locals.broadcastCommentary(result.matchId, result);
    }

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error creating commentary:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});
