import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

function authRequired(roles = []) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const token = header.slice("Bearer ".length);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (!user || !user.active) {
        return res.status(401).json({ error: "This account is inactive or no longer exists." });
      }
      req.user = user;
      if (roles.length && !roles.includes(user.role)) {
        return res.status(403).json({ error: "You do not have permission to do this." });
      }
      next();
    } catch (error) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
  };
}

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export default authRequired;
