/**
 * Course outline: modules → lessons → (optional per-lesson quiz).
 *
 * Lessons are addressed by a stable `key` (not their array position) so progress
 * recorded today still lines up if the outline is re-ordered or re-titled later.
 *
 * Everything here is pure and defensive: it is fed straight from the request body
 * when a teacher saves their curriculum, so malformed input must be normalised,
 * never thrown on.
 */
export const QUIZ_LESSON_KEY = "quiz";

export const LESSON_TYPES = ["video", "code", "quiz", "document"];

export const defaultCurriculum = [
  { key: "welcome", title: "Welcome & setup", type: "video", duration: "06:12" },
  { key: "variables", title: "Values, variables & types", type: "video", duration: "14:35" },
  { key: "control-flow", title: "Control flow in practice", type: "video", duration: "18:20" },
  { key: "practice", title: "Hands-on practice build", type: "code", duration: "20 min" },
  { key: QUIZ_LESSON_KEY, title: "Module knowledge check", type: "quiz", duration: "5 questions" },
];

/**
 * Built-in, language-agnostic check used until a lesson ships its own quiz.
 * Answers live only on the server; the client never receives `answer`.
 */
export const defaultQuiz = {
  title: "Module knowledge check",
  passScore: 60,
  questions: [
    {
      prompt: "Which structure stores an ordered, changeable sequence of items?",
      options: ["List / Array", "Set", "Map / Dictionary", "String"],
      answer: 0,
    },
    {
      prompt: "What is the main job of a function?",
      options: [
        "Store files on disk",
        "Group reusable logic behind a name",
        "Compile the program",
        "Style the user interface",
      ],
      answer: 1,
    },
    {
      prompt: "A loop is used to…",
      options: ["Make a decision", "Repeat a block of work", "Declare a variable", "Import a library"],
      answer: 1,
    },
    {
      prompt: "Which value is typically falsy in most languages?",
      options: ["1", '"text"', "0", "[]"],
      answer: 2,
    },
    {
      prompt: "What does debugging mean?",
      options: ["Deleting unused code", "Finding and fixing defects", "Renaming variables", "Writing documentation"],
      answer: 1,
    },
  ],
};

/** A course with no authoring yet is presented as a single default module. */
export function defaultModules(curriculum = defaultCurriculum) {
  return [
    {
      moduleId: "module-1",
      title: "Module 1 · Getting started",
      order: 0,
      lessons: curriculum.map((lesson, index) => ({
        ...lesson,
        order: index,
        assetId: null,
        quiz: null,
      })),
    },
  ];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function keyFromTitle(title, fallback) {
  const base = String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || fallback;
}

function normalizeQuiz(raw) {
  if (!raw || typeof raw !== "object") return null;
  const cleaned = (Array.isArray(raw.questions) ? raw.questions : [])
    .map((question) => {
      const options = (Array.isArray(question?.options) ? question.options : [])
        .map((option) => String(option ?? "").trim())
        .filter(Boolean);
      const prompt = String(question?.prompt ?? "").trim();
      if (!prompt || options.length < 2) return null;
      const answer = Number(question?.answer);
      return {
        prompt,
        options,
        answer: Number.isInteger(answer) && answer >= 0 && answer < options.length ? answer : 0,
      };
    })
    .filter(Boolean);
  if (!cleaned.length) return null;
  const passScore = clamp(Number(raw.passScore) || 60, 1, 100);
  return {
    title: String(raw.title ?? "").trim() || "Module knowledge check",
    passScore,
    questions: cleaned,
  };
}

/**
 * Sanitises a teacher-supplied outline into the stored shape. Keys are reused
 * when present (so progress survives edits) and generated + de-duplicated when
 * a new lesson is added. Empty modules/lessons keep a sensible title.
 */
export function normalizeModules(input) {
  const modules = Array.isArray(input) ? input : [];
  const seen = new Set();
  return modules.map((module, moduleIndex) => {
    const moduleId = String(module?.moduleId ?? "").trim() || `module-${moduleIndex + 1}`;
    const title = String(module?.title ?? "").trim() || `Module ${moduleIndex + 1}`;
    const lessons = (Array.isArray(module?.lessons) ? module.lessons : []).map((lesson, lessonIndex) => {
      const lessonTitle = String(lesson?.title ?? "").trim() || `Lesson ${lessonIndex + 1}`;
      const baseKey = String(lesson?.key ?? "").trim() || keyFromTitle(lessonTitle, `lesson-${moduleIndex + 1}-${lessonIndex + 1}`);
      let key = baseKey;
      let suffix = 2;
      while (seen.has(key)) key = `${baseKey}-${suffix++}`;
      seen.add(key);

      const type = LESSON_TYPES.includes(lesson?.type) ? lesson.type : "video";
      return {
        key,
        title: lessonTitle,
        type,
        duration: String(lesson?.duration ?? "").trim(),
        assetId: lesson?.assetId ? String(lesson.assetId) : null,
        quiz: type === "quiz" ? normalizeQuiz(lesson?.quiz) : null,
        order: lessonIndex,
      };
    });
    return { moduleId, title, order: moduleIndex, lessons };
  });
}

/** Flattens modules into a single ordered lesson list, tagging each with its module. */
export function flattenModules(modules) {
  const out = [];
  (Array.isArray(modules) ? modules : []).forEach((module, moduleIndex) => {
    (Array.isArray(module?.lessons) ? module.lessons : []).forEach((lesson, lessonIndex) => {
      out.push({
        key: lesson.key,
        title: lesson.title,
        type: lesson.type ?? "video",
        duration: lesson.duration ?? "",
        assetId: lesson.assetId ?? null,
        quiz: lesson.quiz ?? null,
        moduleId: module.moduleId,
        moduleTitle: module.title,
        moduleOrder: module.order ?? moduleIndex,
        order: lesson.order ?? lessonIndex,
      });
    });
  });
  return out;
}

/** The modules to show for a course, deriving one default module when unset. */
export function modulesFor(course) {
  if (course?.modules?.length) return course.modules;
  return defaultModules(course?.curriculum?.length ? course.curriculum : defaultCurriculum);
}

/** The flat ordered lesson list for a course (module-aware). */
export function curriculumFor(course) {
  if (course?.modules?.length) return flattenModules(course.modules);
  if (course?.curriculum?.length) return course.curriculum;
  return defaultCurriculum;
}

/** Freshest-value quiz lesson: an explicit key wins, else the last quiz lesson. */
export function quizLessonFor(course, lessonKey) {
  const lessons = curriculumFor(course);
  if (lessonKey) return lessons.find((lesson) => lesson.key === lessonKey) ?? null;
  const quizLessons = lessons.filter((lesson) => lesson.type === "quiz");
  return quizLessons[quizLessons.length - 1] ?? lessons.find((lesson) => lesson.key === QUIZ_LESSON_KEY) ?? null;
}

/** The quiz to serve, falling back to the built-in check when a lesson has none. */
export function quizFor(course, lessonKey) {
  const lesson = quizLessonFor(course, lessonKey);
  if (lesson?.quiz?.questions?.length) {
    return { ...lesson.quiz, lessonKey: lesson.key };
  }
  return { ...defaultQuiz, lessonKey: lesson?.key ?? QUIZ_LESSON_KEY };
}

/**
 * Grades answers against a quiz and returns a per-question review.
 *
 * Pure and total: a missing or out-of-range answer counts as wrong rather than
 * throwing, so a malformed submission can only ever lower the score.
 */
export function gradeQuiz(questions = [], answers = []) {
  const total = questions.length;
  let score = 0;
  const review = questions.map((question, index) => {
    const raw = answers?.[index];
    const chosen = Number.isInteger(raw) && raw >= 0 && raw < question.options.length ? raw : -1;
    const correct = chosen === question.answer;
    if (correct) score += 1;
    return {
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.answer,
      chosen,
    };
  });
  const percent = total ? Math.round((score / total) * 100) : 0;
  return { score, total, percent, review };
}

/** 0-100 approximation of how much of the outline a completion count covers. */
export function completionPercent(completedKeys, course) {
  const lessons = curriculumFor(course);
  if (!lessons.length) return 0;
  const done = new Set(completedKeys);
  const matched = lessons.filter((lesson) => done.has(lesson.key)).length;
  return Math.min(100, Math.round((matched / lessons.length) * 100));
}
