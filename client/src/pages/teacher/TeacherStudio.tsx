import { useMemo } from "react";
import { BookOpen, GraduationCap, HardDrive, Layers } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { Asset, Course, View } from "../../types";
import { formatBytes } from "../../data/constants";
import AssetUploader from "../../components/AssetUploader";
import AssetTable from "../../components/AssetTable";

export default function TeacherStudio({
  courses,
  assets,
  setAssets,
  goTo,
}: {
  courses: Course[];
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  goTo: (view: View) => void;
}) {
  const { user } = useAuth();

  // The portal is unique per teacher: only courses they own and only resources
  // they uploaded. Everything else stays invisible rather than read-only.
  const myCourses = useMemo(
    () => (user ? courses.filter((course) => course.createdBy === user.email) : []),
    [courses, user]
  );
  const myUploads = useMemo(
    () => (user ? assets.filter((asset) => asset.createdBy === user.email) : []),
    [assets, user]
  );

  const totalBytes = useMemo(() => myUploads.reduce((sum, a) => sum + (a.size || 0), 0), [myUploads]);
  const coursesWithContent = new Set(myUploads.map((a) => a.course)).size;

  if (!user) return null;

  return (
    <div className="page-content admin-page">
      <section className="page-intro split admin-hero">
        <div>
          <span className="eyebrow accent">Content studio</span>
          <h1>Publish course content.</h1>
          <p>Upload recorded lessons and reference documents for your own courses. Learners permitted to access the course will see them straight away.</p>
        </div>
        <div className="hero-actions">
          <button className="primary-small" type="button" onClick={() => goTo("teacherCourses")}>Manage courses</button>
        </div>
      </section>

      <section className="admin-kpis">
        <article><span className="kpi-icon violet"><BookOpen size={19} /></span><div><strong>{myCourses.length}</strong><small>Your courses</small></div><em>Owned by you</em></article>
        <article><span className="kpi-icon green"><GraduationCap size={19} /></span><div><strong>{myUploads.length}</strong><small>Your uploads</small></div><em>Published</em></article>
        <article><span className="kpi-icon blue"><Layers size={19} /></span><div><strong>{coursesWithContent}</strong><small>Courses covered</small></div><em>By your content</em></article>
        <article><span className="kpi-icon orange"><HardDrive size={19} /></span><div><strong>{formatBytes(totalBytes)}</strong><small>Storage used</small></div><em>Your uploads</em></article>
      </section>

      {myCourses.length === 0 ? (
        <div className="empty-state">
          Create a course first — content can only be published into courses you own.{" "}
          <button className="text-button" type="button" onClick={() => goTo("teacherCourses")}>
            Create your first course →
          </button>
        </div>
      ) : (
        <div className="admin-grid">
          <AssetUploader
            courses={myCourses}
            onUploaded={(asset) => setAssets((current) => [asset, ...current])}
            heading="Add course content"
            subheading="Videos and documents are stored securely and streamed to learners."
          />
          <section className="publish-checklist">
            <span className="eyebrow">Publishing checklist</span>
            <h2>Make every lesson land.</h2>
            {[
              ["01", "Clear title", "Tell learners exactly what they will be able to do."],
              ["02", "Focused recording", "Keep each video centered on one practical outcome."],
              ["03", "Useful resources", "Add notes, references, or exercises beside the lesson."],
              ["04", "Knowledge check", "Finish a module with practice and a short quiz."],
            ].map(([num, title, body]) => (
              <div key={num}>
                <span>{num}</span>
                <p>
                  <strong>{title}</strong>
                  <small>{body}</small>
                </p>
              </div>
            ))}
          </section>
        </div>
      )}

      <section className="library-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Content library</span>
            <h2>Your published resources</h2>
          </div>
        </div>
        <AssetTable
          assets={myUploads}
          courses={courses}
          canManage={() => true}
          onUpdated={(asset) =>
            setAssets((current) => current.map((item) => (item._id === asset._id ? asset : item)))
          }
          onDeleted={(asset) => setAssets((current) => current.filter((item) => item._id !== asset._id))}
          emptyTitle="Nothing published yet"
          emptyBody="Upload your first recorded lesson or course document using the form above."
        />
      </section>
    </div>
  );
}
