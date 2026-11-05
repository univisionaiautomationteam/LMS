const ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.PORTAL_LOG ?? ""));
const VERBOSE = /^(1|true|yes|on)$/i.test(String(process.env.PORTAL_LOG_VERBOSE ?? ""));

const SENSITIVE_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "temporarypassword",
  "token",
  "authorization",
  "refreshtoken",
  "accesstoken",
]);

/** Attach who is using the portal for server-side logs (never sent to the client). */
export function setPortalActor(req, actor) {
  if (!actor) return;
  req.portalActor = {
    email: actor.email ?? null,
    role: actor.role ?? null,
    id: actor.id ?? null,
  };
}

function sanitizeValue(key, value) {
  if (SENSITIVE_KEYS.has(String(key).toLowerCase())) return "[redacted]";
  if (typeof value === "string" && value.length > 240) return `${value.slice(0, 240)}…`;
  return value;
}

function sanitizeBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    out[key] = sanitizeValue(key, value);
  }
  return out;
}

function shouldSkip(path) {
  return path === "/api/health" || path.startsWith("/uploads/");
}

/**
 * Logs each API request when PORTAL_LOG=1. Output goes to stdout only (pm2 logs),
 * not to the browser.
 */
export function portalLog(req, res, next) {
  if (!ENABLED) return next();

  const path = req.originalUrl?.split("?")[0] ?? req.path;
  if (shouldSkip(path)) return next();

  const started = Date.now();

  res.on("finish", () => {
    const actor = req.portalActor ?? {};
    const entry = {
      ts: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl ?? req.path,
      status: res.statusCode,
      ms: Date.now() - started,
      ip: req.ip,
      role: actor.role ?? null,
      email: actor.email ?? null,
      userId: actor.id ?? null,
    };

    const logBody =
      VERBOSE || (res.statusCode >= 400 && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method));
    if (logBody) {
      entry.body = sanitizeBody(req.body);
    }
    if (req.portalLogDetail) {
      entry.detail = req.portalLogDetail;
    }

    const line = `[portal] ${JSON.stringify(entry)}`;
    if (res.statusCode >= 500) console.error(line);
    else if (res.statusCode >= 400) console.warn(line);
    else console.log(line);
  });

  next();
}
