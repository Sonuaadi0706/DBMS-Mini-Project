import { NextResponse } from 'next/server';
import { ApiError, assertSameOrigin, toErrorResponse } from './errors';

/**
 * Wraps a Route Handler: same-origin check, awaits Next 15 async params, JSON in/out, and maps every
 * thrown error (ApiError, Zod, Postgres) to a consistent `{ error: { code, message, fields? } }` body.
 */
export function api<P extends Record<string, string> = Record<string, never>>(
  fn: (req: Request, params: P) => Promise<unknown>,
  successStatus = 200,
) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const out = await fn(req, await ctx.params);
      return out instanceof Response ? out : NextResponse.json(out, { status: successStatus });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function intParam(v: string, name = 'id'): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'bad_request', `Invalid ${name}.`);
  return n;
}
