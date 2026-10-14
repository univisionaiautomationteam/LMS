import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { WeeklyGoal } from "../types";

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

function hoursInput(minutes: number): string {
  return String(Math.round((minutes / 60) * 100) / 100);
}

/**
 * The sidebar weekly goal. Reads and writes the caller's own goal through the
 * API, so the number survives refreshes and edits instead of being hardcoded
 * markup. The server rolls the counter over when a new ISO week begins.
 */
export default function WeeklyGoalCard() {
  const [goal, setGoal] = useState<WeeklyGoal | null>(null);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [targetHours, setTargetHours] = useState("5");
  const [loggedHours, setLoggedHours] = useState("0");

  useEffect(() => {
    api
      .getWeeklyGoal()
      .then(({ goal }) => {
        setGoal(goal);
        setTargetHours(hoursInput(goal.targetMinutes));
        setLoggedHours(hoursInput(goal.completedMinutes));
      })
      .catch(() => setStatus("Could not load your weekly goal."));
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const targetMinutes = Math.round(Number(targetHours) * 60);
    const completedMinutes = Math.round(Number(loggedHours) * 60);
    if (!Number.isFinite(targetMinutes) || targetMinutes < 15) {
      setStatus("Set a target of at least 15 minutes.");
      return;
    }
    if (!Number.isFinite(completedMinutes) || completedMinutes < 0) {
      setStatus("Completed time cannot be negative.");
      return;
    }
    setStatus("Saving…");
    try {
      const { goal: saved } = await api.updateWeeklyGoal({ targetMinutes, completedMinutes });
      setGoal(saved);
      setEditing(false);
      setStatus("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to save your goal.");
    }
  }

  const pct = goal && goal.targetMinutes > 0 ? Math.min(100, Math.round((goal.completedMinutes / goal.targetMinutes) * 100)) : 0;
  const remaining = goal ? goal.targetMinutes - goal.completedMinutes : 0;

  return (
    <div className="sidebar-card">
      <span className="eyebrow">Weekly goal</span>

      {!goal && <p>{status || "Loading goal…"}</p>}

      {goal && !editing && (
        <>
          <div className="goal-row">
            <strong>{formatMinutes(goal.completedMinutes)}</strong>
            <span>of {formatMinutes(goal.targetMinutes)}</span>
          </div>
          <div className="progress-track"><span style={{ width: `${pct}%` }} /></div>
          <p>{remaining > 0 ? `${formatMinutes(remaining)} to go this week.` : "Goal reached. Nice work."}</p>
          <button className="text-button goal-edit-button" type="button" onClick={() => setEditing(true)}>
            Edit goal
          </button>
        </>
      )}

      {goal && editing && (
        <form className="goal-edit-form" onSubmit={save}>
          <label>
            Target (hours)
            <input
              type="number"
              min={0.25}
              max={168}
              step={0.25}
              value={targetHours}
              onChange={(e) => setTargetHours(e.target.value)}
              required
            />
          </label>
          <label>
            Completed (hours)
            <input
              type="number"
              min={0}
              max={168}
              step={0.25}
              value={loggedHours}
              onChange={(e) => setLoggedHours(e.target.value)}
            />
          </label>
          <div className="goal-edit-actions">
            <button className="primary-small" type="submit">Save</button>
            <button className="text-button" type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}

      {status && goal && <p role="status">{status}</p>}
    </div>
  );
}
