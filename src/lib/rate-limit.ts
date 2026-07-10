// Simple fixed-window per-key rate limiter, in-memory only - no external
// service (Redis/KV), by design: this is a defense-in-depth layer against
// scripted abuse of the Anthropic-backed routes, not the real backstop
// (that's the Anthropic spend cap). On Vercel serverless this is
// best-effort, not a hard guarantee - a burst of requests can land on
// different warm function instances, each with its own independent
// counter, so a determined abuser spread across enough cold starts could
// exceed the nominal limit. It still catches the common case (a script
// hammering one endpoint in a tight loop typically keeps hitting the same
// warm instance) at zero cost and zero new dependencies. See CLAUDE.md's
// Deployment notes. Friends-scale: the handful of distinct IPs this will
// ever see makes unbounded Map growth a non-issue, so there's no eviction
// sweep here.

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count < limit) {
    bucket.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.windowStart + windowMs - now) / 1000)
  );
  return { allowed: false, retryAfterSeconds };
}

// Vercel (and most reverse proxies) set x-forwarded-for to
// "<client>, <proxy1>, <proxy2>, …" - the first entry is the original
// client. Falls back to x-real-ip, then a shared "unknown" bucket for
// local dev without a proxy in front (curl doesn't set either header).
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
