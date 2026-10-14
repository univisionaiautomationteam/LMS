/**
 * Two-tier admin scoping.
 *
 *   admin (super admin)  -> collegeId = null -> sees every college
 *   collegeAdmin         -> collegeId = ABC  -> sees only ABC
 *   teacher / student    -> collegeId = ABC  -> only ABC
 *
 * The college always comes from the authenticated user, never from the request,
 * so a caller can never widen its own scope by posting a different college id.
 */

export function isSuperAdmin(user) {
  return user?.role === "admin";
}

export function isCollegeAdmin(user) {
  return user?.role === "collegeAdmin";
}

/** null means "no restriction" (super admin); otherwise the caller's college id. */
export function collegeScope(user) {
  if (isSuperAdmin(user)) return null;
  return user?.collegeId ? String(user.collegeId) : null;
}

/**
 * A Mongo filter that confines a query to the caller's college. Super admin gets
 * an empty filter (everything); everyone else is pinned to their own college.
 * An unassigned non-super account resolves to a filter that can never match, so
 * it fails closed instead of leaking every college.
 */
export function scopeToCollege(user, field = "collegeId") {
  if (isSuperAdmin(user)) return {};
  const collegeId = user?.collegeId ? String(user.collegeId) : null;
  return { [field]: collegeId ?? { $in: [] } };
}

/** True when the caller may administer the given college (super admin, or its own college admin). */
export function canAdminCollege(user, collegeId) {
  if (isSuperAdmin(user)) return true;
  if (!isCollegeAdmin(user)) return false;
  return Boolean(user.collegeId) && String(user.collegeId) === String(collegeId);
}

/**
 * A Mongo filter for content that belongs to the caller's college, treating
 * platform content (`null`) as visible everywhere. Super admin gets `{}` (no
 * restriction). An unassigned non-super account fails closed.
 *
 * Used for Course/Asset queries, where a `null` value means "platform-wide".
 */
export function collegeVisibilityFilter(user, field = "collegeId") {
  if (isSuperAdmin(user)) return {};
  const collegeId = user?.collegeId ? user.collegeId : null;
  if (!collegeId) return { [field]: { $in: [] } };
  return { $or: [{ [field]: collegeId }, { [field]: null }] };
}
