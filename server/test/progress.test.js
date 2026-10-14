import test from "node:test";
import assert from "node:assert/strict";
import { gradeQuiz, completionPercent, curriculumFor, defaultCurriculum, QUIZ_LESSON_KEY } from "../src/utils/curriculum.js";

const questions = [
  { prompt: "Q1", options: ["a", "b", "c"], answer: 1 },
  { prompt: "Q2", options: ["a", "b"], answer: 0 },
  { prompt: "Q3", options: ["a", "b", "c"], answer: 2 },
];

test("gradeQuiz scores correct answers and builds a review", () => {
  const result = gradeQuiz(questions, [1, 0, 2]);
  assert.equal(result.score, 3);
  assert.equal(result.total, 3);
  assert.equal(result.percent, 100);
  assert.deepEqual(
    result.review.map((r) => r.chosen),
    [1, 0, 2]
  );
  assert.deepEqual(
    result.review.map((r) => r.correctIndex),
    [1, 0, 2]
  );
});

test("gradeQuiz counts wrong, missing and out-of-range answers as wrong", () => {
  const result = gradeQuiz(questions, [0, 99, -3]);
  assert.equal(result.score, 0);
  assert.equal(result.percent, 0);
  // A malformed answer is normalised to -1 rather than throwing.
  assert.deepEqual(
    result.review.map((r) => r.chosen),
    [0, -1, -1]
  );
});

test("gradeQuiz is total for empty or malformed input", () => {
  assert.deepEqual(gradeQuiz([], []), { score: 0, total: 0, percent: 0, review: [] });
  const short = gradeQuiz(questions, []);
  assert.equal(short.score, 0);
  assert.equal(short.review.length, 3);
});

test("curriculumFor falls back to the default outline", () => {
  assert.equal(curriculumFor(null), defaultCurriculum);
  assert.equal(curriculumFor({ curriculum: [] }).length, defaultCurriculum.length);
  const custom = [{ key: "a", title: "A", type: "video" }];
  assert.equal(curriculumFor({ curriculum: custom }), custom);
});

test("completionPercent only counts keys present in the outline", () => {
  // The quiz lesson completes the outline for this course.
  assert.equal(completionPercent([QUIZ_LESSON_KEY], null), Math.round((1 / defaultCurriculum.length) * 100));
  assert.equal(completionPercent(defaultCurriculum.map((l) => l.key), null), 100);
  // Unknown keys and duplicates cannot exceed 100%.
  assert.equal(completionPercent(["ghost", ...defaultCurriculum.map((l) => l.key)], null), 100);
  assert.equal(completionPercent([], null), 0);
});
