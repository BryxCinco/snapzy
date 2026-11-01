import type { SupabaseClient } from "@supabase/supabase-js";

// Per-user limits, counted in the database (supabase/migrations/011_rate_limits.sql)
// so they hold across serverless instances. Change the numbers here.
export const RATE_LIMITS = {
  // One unit per uploaded file.
  upload: { limit: 20, windowSeconds: 60 * 60, label: "Upload" },
  // One unit per 10 photos sent to the AI (a normal "Sort photos" press is 1).
  sort: { limit: 20, windowSeconds: 60 * 60, label: "AI sorting" },
} as const;

export type RateLimitedAction = keyof typeof RATE_LIMITS;

export type RateLimitResult = { ok: true } | { ok: false; error: string };

function waitText(seconds: number) {
  if (seconds < 90) return `${seconds} seconds`;
  return `${Math.ceil(seconds / 60)} minutes`;
}

/**
 * Records `cost` units of `action` for the signed-in user, or refuses when
 * that would pass the hourly limit.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  action: RateLimitedAction,
  cost = 1,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[action];
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_action: action,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
    p_cost: Math.max(1, Math.ceil(cost)),
  });

  if (error) {
    // PGRST202 = function not found: migration 011 hasn't been run yet. Keep
    // the app working rather than locking everyone out.
    if (error.code === "PGRST202") {
      console.warn("[snapzy] rate limiting is off: run supabase/migrations/011_rate_limits.sql");
      return { ok: true };
    }
    console.error("[snapzy] rate limit check failed:", error.message);
    return { ok: false, error: "Couldn't check your usage limit. Try again in a moment." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; retry_after_seconds: number }
    | undefined;
  if (row?.allowed) return { ok: true };

  return {
    ok: false,
    error: `${rule.label} limit reached (${rule.limit} per hour). Try again in ${waitText(
      row?.retry_after_seconds ?? rule.windowSeconds,
    )}.`,
  };
}
