import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const HEADERS = { standardHeaders: "draft-7", legacyHeaders: false };

/** Broad backstop so a single client cannot flood the API. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  ...HEADERS,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

/**
 * Keyed on IP *and* submitted email so one attacker cannot lock every account
 * out by spraying a shared IP, and one account cannot be brute-forced from
 * thousands of IPs. Only failures count, so a user who types the right password
 * is never penalised for earlier typos.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  ...HEADERS,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  skipSuccessfulRequests: true,
  message: { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
});

/** Stops automated bulk account creation. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  ...HEADERS,
  message: { error: "Too many accounts created from this network. Please try again later." },
});

/** The code lab bills an external Judge0/Piston quota, so it needs its own cap. */
export const codeRunLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  ...HEADERS,
  keyGenerator: (req) => (req.user ? `u:${req.user._id}` : ipKeyGenerator(req.ip)),
  message: { error: "You are running code too quickly. Please wait a moment and try again." },
});
