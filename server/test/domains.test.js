import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomains, emailDomain } from "../src/utils/domains.js";

test("normalizeDomains accepts @host and strips duplicates", () => {
  assert.deepEqual(normalizeDomains("@ABC.com, abc.com, krishna.com"), ["abc.com", "krishna.com"]);
  assert.deepEqual(normalizeDomains("demo.edu; @demo.edu"), ["demo.edu"]);
});

test("emailDomain extracts hostname", () => {
  assert.equal(emailDomain("Teacher@ABC.COM"), "abc.com");
  assert.equal(emailDomain("invalid"), "");
});
