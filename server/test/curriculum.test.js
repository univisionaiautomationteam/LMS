import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeModules,
  flattenModules,
  curriculumFor,
  quizFor,
  completionPercent,
  defaultQuiz,
} from "../src/utils/curriculum.js";

const raw = [
  {
    title: "Basics",
    lessons: [
      { title: "Intro", type: "video", duration: "05:00" },
      { title: "Intro", type: "video" },
      {
        title: "Check",
        type: "quiz",
        quiz: {
          title: "Basics check",
          passScore: 70,
          questions: [
            { prompt: "Q", options: ["a", "b"], answer: 5 },
            { prompt: "", options: ["a", "b"], answer: 0 },
          ],
        },
      },
    ],
  },
];

test("normalizeModules sanitises titles, keys and quiz answers", () => {
  const modules = normalizeModules(raw);
  assert.equal(modules.length, 1);
  assert.equal(modules[0].title, "Basics");
  assert.equal(modules[0].lessons.length, 3);

  // Duplicate titles still get unique, stable-looking keys.
  const keys = modules[0].lessons.map((lesson) => lesson.key);
  assert.equal(new Set(keys).size, 3);
  assert.ok(keys.every(Boolean));

  // An out-of-range/blank answer is dropped or clamped, never stored as-is.
  const quiz = modules[0].lessons[2].quiz;
  assert.equal(quiz.passScore, 70);
  assert.equal(quiz.questions.length, 1);
  assert.equal(quiz.questions[0].answer, 0);
});

test("normalizeModules keeps existing keys so progress survives edits", () => {
  const modules = normalizeModules([{ moduleId: "m-x", title: "M", lessons: [{ key: "kept", title: "T", type: "video" }] }]);
  assert.equal(modules[0].moduleId, "m-x");
  assert.equal(modules[0].lessons[0].key, "kept");
});

test("flattenModules tags each lesson with its module", () => {
  const modules = normalizeModules(raw);
  const flat = flattenModules(modules);
  assert.equal(flat.length, 3);
  assert.equal(flat[0].moduleTitle, "Basics");
  assert.equal(flat[2].type, "quiz");
  assert.equal(flat[1].order, 1);
});

test("curriculumFor prefers modules and falls back gracefully", () => {
  const modules = normalizeModules(raw);
  assert.equal(curriculumFor({ modules }).length, 3);
  // Legacy flat outline still wins when there are no modules.
  const legacy = [{ key: "a", title: "A", type: "video" }];
  assert.equal(curriculumFor({ curriculum: legacy }), legacy);
});

test("quizFor serves the authored lesson quiz, else the built-in check", () => {
  const modules = normalizeModules(raw);
  const course = { modules };
  const quiz = quizFor(course);
  assert.equal(quiz.title, "Basics check");
  assert.equal(quiz.lessonKey, modules[0].lessons[2].key);
  // No authored quiz anywhere → default.
  assert.equal(quizFor(null).questions.length, defaultQuiz.questions.length);
});

test("completionPercent splits across the real module lesson count", () => {
  const modules = normalizeModules(raw);
  const course = { modules };
  const keys = flattenModules(modules).map((lesson) => lesson.key);
  assert.equal(completionPercent(keys, course), 100);
  assert.equal(completionPercent([keys[0]], course), Math.round((1 / 3) * 100));
  assert.equal(completionPercent([], course), 0);
});
