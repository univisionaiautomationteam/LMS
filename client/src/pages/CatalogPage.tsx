import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import type { Course } from "../types";

export default function CatalogPage({
  search,
  availableCourses,
  openCourse,
}: {
  search: string;
  availableCourses: Course[];
  openCourse: (id: string) => void;
}) {
  const [levelFilter, setLevelFilter] = useState<"All" | "Beginner" | "Intermediate" | "Advanced">("All");

  const filtered = useMemo(
    () =>
      availableCourses.filter(
        (c) =>
          `${c.title} ${c.language} ${c.category} ${c.level}`.toLowerCase().includes(search.toLowerCase()) &&
          (levelFilter === "All" || c.level === levelFilter)
      ),
    [search, availableCourses, levelFilter]
  );

  return (
    <div className="page-content">
      <section className="page-intro">
        <span className="eyebrow accent">Engineering course catalog</span>
        <h1>Learn by building.</h1>
        <p>Explore computer science, AI, electronics, electrical, civil, mechanical, robotics, VLSI, embedded systems, and more.</p>
      </section>
      <div className="filter-row">
        {(["All", "Beginner", "Intermediate", "Advanced"] as const).map((filter) => (
          <button key={filter} className={`filter ${levelFilter === filter ? "active" : ""}`} onClick={() => setLevelFilter(filter)}>
            {filter === "All" ? "All courses" : filter}
          </button>
        ))}
        <span>{filtered.length} courses</span>
      </div>
      <div className="catalog-grid">
        {filtered.map((course) => (
          <article className="catalog-card" key={course.slug}>
            <button className="catalog-art" style={{ background: course.color }} onClick={() => openCourse(course.slug)}>
              <span>{course.icon}</span><small>{course.category.toUpperCase()} PATHWAY</small>
            </button>
            <div className="catalog-body">
              <div className="rating-row"><span className="pill">{course.level}</span></div>
              <h2>{course.title}</h2>
              <p>{course.description}</p>
              <div className="course-facts"><span>{course.lessons} lessons</span><span>{course.duration}</span></div>
              <button className="card-button" onClick={() => openCourse(course.slug)}>{course.progress ? "Continue course" : "Start learning"} <span>→</span></button>
            </div>
          </article>
        ))}
        {!filtered.length && (
          <div className="course-access-empty">
            <BookOpen size={28} /><h2>No courses assigned yet</h2>
            <p>Your college administrator has not assigned courses to this account. Contact your college or platform administrator for access.</p>
          </div>
        )}
      </div>
    </div>
  );
}
