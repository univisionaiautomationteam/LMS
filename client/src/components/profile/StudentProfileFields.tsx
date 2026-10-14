import type { StudentProfileDetails } from "../../types";

/**
 * Student-only profile inputs. `degree` and `studyYear` are required by the
 * server before a student profile counts as complete; the guardian and course
 * type fields are optional but were previously unreachable — there was no UI
 * to write them, so they never reached MongoDB.
 */
export default function StudentProfileFields({ details }: { details?: StudentProfileDetails }) {
  return (
    <section className="profile-form-section">
      <h2>Student details</h2>
      <div className="form-row">
        <label>
          Degree / program
          <input name="degree" required defaultValue={details?.degree} placeholder="e.g. B.Tech" />
        </label>
        <label>
          Current year
          <select name="studyYear" defaultValue={details?.studyYear || "1st Year"}>
            <option>1st Year</option>
            <option>2nd Year</option>
            <option>3rd Year</option>
            <option>4th Year</option>
            <option>Graduate</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Guardian name
          <input name="guardianName" defaultValue={details?.guardianName} placeholder="Parent or guardian" />
        </label>
        <label>
          Guardian phone
          <input name="guardianPhone" type="tel" defaultValue={details?.guardianPhone} placeholder="Guardian contact number" />
        </label>
      </div>
      <label>
        Course type
        <input name="courseType" defaultValue={details?.courseType} placeholder="e.g. Full-time, Part-time, Distance" />
      </label>
    </section>
  );
}
