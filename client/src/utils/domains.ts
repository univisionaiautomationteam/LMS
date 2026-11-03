export function formatDomainLabel(domain: string): string {
  const host = String(domain ?? "").trim().toLowerCase().replace(/^@+/, "");
  return host ? `@${host}` : "";
}

export function formatDomainList(domains: string[] | undefined): string {
  if (!domains?.length) return "No domains set";
  return domains.map(formatDomainLabel).join(", ");
}

/** Normalize user input before sending to the API (server normalizes again). */
export function parseDomainsInput(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((part) => part.trim().replace(/^@+/, "").toLowerCase())
    .filter(Boolean);
}

export function emailMatchesDomains(email: string, domains: string[]): boolean {
  const host = email.includes("@") ? email.split("@").pop()?.toLowerCase() ?? "" : "";
  if (!host) return false;
  const allowed = new Set(domains.map((d) => d.toLowerCase().replace(/^@+/, "")));
  return allowed.has(host);
}
