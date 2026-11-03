import { College } from "../models/College.js";

/** Turns "@ABC.edu, xyz.com" into ["abc.edu", "xyz.com"] (lowercase, deduped). */
export function normalizeDomains(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/[\s,;]+/);
  const seen = new Set();
  for (const raw of list) {
    const domain = String(raw ?? "")
      .trim()
      .toLowerCase()
      .replace(/^@+/, "")
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (domain && domain.includes(".")) seen.add(domain);
  }
  return [...seen];
}

export function emailDomain(email) {
  const address = String(email ?? "").trim().toLowerCase();
  if (!address.includes("@")) return "";
  return address.split("@").pop() ?? "";
}

/** Load every college's domains and who owns each hostname. */
export async function loadDomainRegistry(excludeCollegeId = null) {
  const colleges = await College.find({}).select("_id code name domains").lean();
  const domainsByCollege = new Map();
  const domainOwner = new Map();
  for (const college of colleges) {
    if (excludeCollegeId && String(college._id) === String(excludeCollegeId)) continue;
    const domains = new Set((college.domains ?? []).map((d) => String(d).toLowerCase()));
    domainsByCollege.set(String(college._id), domains);
    for (const domain of domains) {
      domainOwner.set(domain, { collegeId: String(college._id), code: college.code, name: college.name });
    }
  }
  return { domainsByCollege, domainOwner, colleges };
}

/**
 * Ensures no hostname in `domains` is already registered to another college.
 * Returns { ok: true } or { ok: false, domain, owner }.
 */
export async function findDomainConflict(domains, excludeCollegeId = null) {
  const normalized = normalizeDomains(domains);
  if (!normalized.length) return { ok: true, domains: normalized };
  const { domainOwner } = await loadDomainRegistry(excludeCollegeId);
  for (const domain of normalized) {
    const owner = domainOwner.get(domain);
    if (owner) return { ok: false, domain, owner };
  }
  return { ok: true, domains: normalized };
}

export async function collegeDomains(collegeId) {
  if (!collegeId) return new Set();
  const college = await College.findById(collegeId).select("domains").lean();
  return new Set((college?.domains ?? []).map((d) => String(d).toLowerCase()));
}

/**
 * College-bound accounts must use an email on one of the college's domains when
 * domains are configured. Platform super admins have no collegeId and skip this.
 */
export async function assertEmailAllowedForCollege(email, collegeId, { role } = {}) {
  if (!collegeId) {
    if (role === "collegeAdmin" || role === "teacher" || role === "student") {
      return { ok: false, error: "A college is required for this account." };
    }
    return { ok: true };
  }
  const allowed = await collegeDomains(collegeId);
  if (!allowed.size) {
    return {
      ok: false,
      error: "This college has no email domains configured yet. Save domains (e.g. @abc.com) before creating accounts.",
    };
  }
  const domain = emailDomain(email);
  if (!domain || !allowed.has(domain)) {
    const list = [...allowed].map((d) => `@${d}`).join(", ");
    return { ok: false, error: `Email must use one of this college's domains: ${list}.` };
  }
  return { ok: true };
}

/** On login, block accounts whose email domain no longer matches their college. */
export async function assertLoginDomainAllowed(user, role) {
  if (role === "admin" || !user.collegeId) return { ok: true };
  const allowed = await collegeDomains(user.collegeId);
  if (!allowed.size) return { ok: true };
  const domain = emailDomain(user.email);
  if (allowed.has(domain)) return { ok: true };
  return {
    ok: false,
    error: "Your email domain is not registered for your college. Contact your college administrator.",
  };
}
