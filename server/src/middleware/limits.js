/**
 * Rate limiting is disabled for now (local/dev friendly).
 * To turn it back on, restore the express-rate-limit exports below and remove `noop`.
 */
// import rateLimit, { ipKeyGenerator } from "express-rate-limit";
//
// const HEADERS = { standardHeaders: "draft-7", legacyHeaders: false };
//
// export const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 300,
//   ...HEADERS,
//   message: { error: "Too many requests. Please slow down and try again shortly." },
// });
//
// export const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 10,
//   ...HEADERS,
//   keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email ?? "").trim().toLowerCase()}`,
//   skipSuccessfulRequests: true,
//   message: { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
// });
//
// export const registerLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000,
//   limit: 5,
//   ...HEADERS,
//   message: { error: "Too many accounts created from this network. Please try again later." },
// });
//
// export const codeRunLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   limit: 30,
//   ...HEADERS,
//   keyGenerator: (req) => (req.user ? `u:${req.user._id}` : ipKeyGenerator(req.ip)),
//   message: { error: "You are running code too quickly. Please wait a moment and try again." },
// });

function noop(_req, _res, next) {
  next();
}

export const globalLimiter = noop;
export const loginLimiter = noop;
export const registerLimiter = noop;
export const codeRunLimiter = noop;
