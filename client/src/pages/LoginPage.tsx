import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login, completePassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  // Driven by the account, not local state, so a reload mid-onboarding still
  // lands on the change-password form.
  const needsOnboarding = user?.mustChangePassword === true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    }
  }

  async function handleCompletePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    try {
      await completePassword(newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change the password.");
    }
  }

  if (needsOnboarding) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <form className="login-form" onSubmit={handleCompletePassword}>
            <span className="eyebrow accent">Password required</span>
            <h2>Create your private password</h2>
            <p>Use at least 10 characters.</p>
            <label>
              New password
              <input type="password" minLength={10} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <label>
              Confirm password
              <input type="password" minLength={10} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit">Change password <span>→</span></button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-brand">
          <span className="brand-mark">T</span>
          <strong>Taras<span>Learn</span></strong>
        </div>
        <div>
          <span className="eyebrow">Engineering learning platform</span>
          <h1>Learn deeply.<br />Build confidently.</h1>
          <p>Recorded courses, practical documents, quizzes, and hands-on coding—organized for every engineering pathway.</p>
        </div>
        <small>Designed for focused technical learning.</small>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <span className="eyebrow accent">Welcome back</span>
          <h2>Sign in to continue</h2>
          <p>Sign in as an administrator, teacher, or student.</p>
          <label>
            Email address
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit">Sign in <span>→</span></button>
        </form>
      </section>
    </main>
  );
}
