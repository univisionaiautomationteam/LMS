export function validateEmail(email) {
  return /^\S+@\S+\.\S+$/.test(String(email ?? "").trim());
}

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeProfile(values) {
  const required = ["collegeName", "department", "state", "city", "phone"];
  const missing = required.find((key) => !String(values[key] ?? "").trim());
  return {
    values,
    missing,
  };
}
