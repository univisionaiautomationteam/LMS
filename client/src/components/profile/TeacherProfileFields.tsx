import type { TeacherProfileDetails } from "../../types";

/**
 * Teacher-only profile inputs. The server requires designation and
 * qualification before a teacher profile can be marked complete, so these
 * fields have to exist somewhere in the UI for a teacher to save at all.
 */
export default function TeacherProfileFields({ details }: { details?: TeacherProfileDetails }) {
  return (
    <section className="profile-form-section">
      <h2>Teaching details</h2>
      <div className="form-row">
        <label>
          Designation
          <input name="designation" required defaultValue={details?.designation} placeholder="e.g. Assistant Professor" />
        </label>
        <label>
          Qualification
          <input name="qualification" required defaultValue={details?.qualification} placeholder="e.g. M.Tech, Ph.D" />
        </label>
      </div>
      <div className="form-row">
        <label>
          Specialization
          <input name="specialization" defaultValue={details?.specialization} placeholder="e.g. Data Structures & Algorithms" />
        </label>
        <label>
          Years of experience
          <input name="experienceYears" inputMode="numeric" pattern="[0-9]{0,3}" defaultValue={details?.experienceYears} placeholder="e.g. 6" />
        </label>
      </div>
    </section>
  );
}
