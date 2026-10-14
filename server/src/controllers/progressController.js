import { Course } from "../models/Course.js";
import { LessonProgress } from "../models/LessonProgress.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
import { resolveCourseAccess, canAccessCourse } from "../utils/access.js";
import { gradeQuiz, curriculumFor, completionPercent, quizFor } from "../utils/curriculum.js";
import { serverError } from "../utils/helpers.js";

/** `YYYY-MM-DD` in UTC, used to fold activity into distinct study days. */
function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Everything the caller has done: which lessons they finished per course, their
 * latest quiz score, and rolled-up numbers for the learner dashboard.
 */
export async function getProgress(req, res) {
  try {
    const learnerId = req.user._id;
    const [rows, attempts, courses] = await Promise.all([
      LessonProgress.find({ learnerId, completed: true }).lean(),
      QuizAttempt.find({ learnerId }).sort({ createdAt: 1 }).lean(),
      Course.find().select("slug curriculum modules").lean(),
    ]);

    const lessonsByCourse = new Map();
    for (const row of rows) {
      if (!lessonsByCourse.has(row.courseId)) lessonsByCourse.set(row.courseId, new Set());
      lessonsByCourse.get(row.courseId).add(row.lessonId);
    }
    // Sorted oldest-first, so the last write for a course is its newest attempt.
    const quizByCourse = new Map();
    for (const attempt of attempts) quizByCourse.set(attempt.courseId, attempt);

    const curriculumBySlug = new Map(courses.map((course) => [course.slug, course]));

    const progress = [];
    for (const slug of new Set([...lessonsByCourse.keys(), ...quizByCourse.keys()])) {
      const completedLessons = [...(lessonsByCourse.get(slug) ?? [])];
      const course = curriculumBySlug.get(slug);
      const total = curriculumFor(course).length;
      const attempt = quizByCourse.get(slug) ?? null;
      progress.push({
        courseId: slug,
        completedLessons,
        total,
        percent: completionPercent(completedLessons, course),
        quiz: attempt
          ? {
              score: attempt.score,
              total: attempt.total,
              percent: attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0,
            }
          : null,
      });
    }

    const passed = attempts.filter((a) => a.passed);
    const averageScore = attempts.length
      ? Math.round(
          (attempts.reduce((sum, a) => sum + (a.total ? a.score / a.total : 0), 0) / attempts.length) * 100
        )
      : 0;
    const activityDates = new Set();
    for (const row of rows) activityDates.add(dayKey(row.updatedAt));
    for (const attempt of attempts) activityDates.add(dayKey(attempt.createdAt));

    res.json({
      progress,
      summary: {
        lessonsCompleted: rows.length,
        quizzesPassed: passed.length,
        averageScore,
        activityDates: [...activityDates].sort(),
      },
    });
  } catch (error) {
    serverError(res, error, "progress.get");
  }
}

/**
 * Marks a lesson complete (or clears it). Keyed by course slug + lesson key so
 * re-watching a lesson can never double-count.
 */
export async function setLessonProgress(req, res) {
  try {
    const courseId = String(req.params.courseId ?? "").trim();
    const lessonId = String(req.params.lessonId ?? "").trim();
    if (!courseId || !lessonId) return res.status(400).json({ error: "Course and lesson are required." });

    const access = await resolveCourseAccess(req.user);
    if (!canAccessCourse(access, courseId)) {
      return res.status(403).json({ error: "You do not have access to this course." });
    }

    const completed = req.body?.completed !== false;
    if (completed) {
      await LessonProgress.updateOne(
        { learnerId: req.user._id, courseId, lessonId },
        { $set: { completed: true } },
        { upsert: true }
      );
    } else {
      await LessonProgress.deleteOne({ learnerId: req.user._id, courseId, lessonId });
    }
    res.json({ ok: true, courseId, lessonId, completed });
  } catch (error) {
    serverError(res, error, "progress.setLesson");
  }
}

/**
 * A course quiz, with answers stripped so they cannot be read off the wire.
 * `lessonKey` targets one quiz lesson; omitted, the course's default quiz is used.
 */
export async function getQuiz(req, res) {
  try {
    const courseId = String(req.params.courseId ?? "").trim();
    const lessonKey = String(req.params.lessonKey ?? "").trim();
    const access = await resolveCourseAccess(req.user);
    if (!canAccessCourse(access, courseId)) {
      return res.status(403).json({ error: "You do not have access to this course." });
    }
    const course = await Course.findOne({ slug: courseId }).select("slug curriculum modules").lean();
    const quiz = quizFor(course, lessonKey || undefined);
    res.json({
      quiz: {
        lessonKey: quiz.lessonKey,
        title: quiz.title,
        total: quiz.questions.length,
        passScore: quiz.passScore,
        questions: quiz.questions.map((question) => ({ prompt: question.prompt, options: question.options })),
      },
    });
  } catch (error) {
    serverError(res, error, "progress.getQuiz");
  }
}

/**
 * Grades a submission server-side (the client never holds the answers). A pass
 * also completes that quiz lesson so the outline stays consistent.
 */
export async function submitQuiz(req, res) {
  try {
    const courseId = String(req.params.courseId ?? "").trim();
    const lessonKey = String(req.params.lessonKey ?? "").trim();
    const access = await resolveCourseAccess(req.user);
    if (!canAccessCourse(access, courseId)) {
      return res.status(403).json({ error: "You do not have access to this course." });
    }

    const course = await Course.findOne({ slug: courseId }).select("slug curriculum modules").lean();
    const quiz = quizFor(course, lessonKey || undefined);
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const result = gradeQuiz(quiz.questions, answers);
    const passed = result.percent >= quiz.passScore;

    await QuizAttempt.create({
      courseId,
      lessonId: quiz.lessonKey,
      learnerId: req.user._id,
      score: result.score,
      total: result.total,
      passed,
      passScore: quiz.passScore,
    });

    if (passed) {
      await LessonProgress.updateOne(
        { learnerId: req.user._id, courseId, lessonId: quiz.lessonKey },
        { $set: { completed: true } },
        { upsert: true }
      );
    }

    res.json({ ...result, passed, passScore: quiz.passScore, lessonKey: quiz.lessonKey });
  } catch (error) {
    serverError(res, error, "progress.submitQuiz");
  }
}
