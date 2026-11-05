import jwt from "jsonwebtoken";
import { findUserById } from "../utils/userLookup.js";
import { setPortalActor } from "./portalLog.js";

function authRequired(roles = []) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        req.portalLogDetail = "auth_missing_bearer";
        return res.status(401).json({ error: "Authentication required." });
      }
      const token = header.slice("Bearer ".length);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const { user, role } = await findUserById(payload.sub);
      if (!user || !user.active) {
        return res.status(401).json({ error: "This account is inactive or no longer exists." });
      }
      // Bumped on password or role change so tokens issued beforehand stop working.
      if ((payload.ver ?? 0) !== (user.tokenVersion ?? 0)) {
        return res.status(401).json({ error: "Your session is no longer valid. Please sign in again." });
      }
      req.user = user;
      req.user.role = user.role ?? role;
      setPortalActor(req, {
        email: user.email,
        role: req.user.role,
        id: user._id.toString(),
      });
      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({ error: "You do not have permission to do this." });
      }
      next();
    } catch (error) {
      const header = req.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        const payload = jwt.decode(header.slice("Bearer ".length));
        if (payload && typeof payload === "object") {
          setPortalActor(req, {
            email: payload.email,
            role: payload.role,
            id: payload.sub,
          });
          req.portalLogDetail = "auth_failed";
        }
      }
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
  };
}

export function signToken(user, role) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role, ver: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export default authRequired;
