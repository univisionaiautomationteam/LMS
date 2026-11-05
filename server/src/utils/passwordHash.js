/**
 * Resolve a bcrypt hash for login. Mongoose strict schemas omit legacy `password`
 * fields; some deployments still store credentials under `password` or only in `users`.
 */
export async function resolvePasswordHash(user) {
  if (!user) return null;
  const direct = user.passwordHash;
  if (typeof direct === "string" && direct.length > 0) return direct;

  const collection = user.collection;
  if (!collection) return null;

  const raw = await collection.findOne(
    { _id: user._id },
    { projection: { passwordHash: 1, password: 1 } }
  );
  const hash = raw?.passwordHash ?? raw?.password;
  if (typeof hash === "string" && hash.length > 0) {
    user.passwordHash = hash;
    return hash;
  }
  return null;
}
