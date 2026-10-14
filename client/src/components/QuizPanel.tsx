import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { QuizQuestion, QuizResult } from "../types";

/**
 * Inline course quiz. Questions are fetched without their answers; grading
 * happens server-side on submit. Passing calls `onPassed` so the parent can mark
 * the quiz lesson complete and refresh progress. `lessonKey` targets a specific
 * quiz lesson when a course has several.
 */
export default function QuizPanel({
  courseSlug,
  lessonKey,
  onPassed,
}: {
  courseSlug: string;
  lessonKey?: string;
  onPassed: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [title, setTitle] = useState("Module knowledge check");
  const [passScore, setPassScore] = useState(60);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setResult(null);
    api
      .getQuiz(courseSlug, lessonKey)
      .then(({ quiz }) => {
        if (cancelled) return;
        setQuestions(quiz.questions);
        setTitle(quiz.title);
        setPassScore(quiz.passScore);
        setAnswers(new Array(quiz.questions.length).fill(-1));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [courseSlug, lessonKey]);

  const answeredCount = answers.filter((a) => a >= 0).length;

  async function submit() {
    setStatus("submitting");
    setMessage("");
    try {
      const graded = await api.submitQuiz(courseSlug, answers, lessonKey);
      setResult(graded);
      setStatus("ready");
      if (graded.passed) onPassed();
    } catch (err) {
      setStatus("ready");
      setMessage(err instanceof Error ? err.message : "Unable to submit your answers.");
    }
  }

  function retry() {
    setResult(null);
    setAnswers(new Array(questions.length).fill(-1));
    setMessage("");
  }

  if (status === "loading") return <div className="quiz-panel"><p className="empty-inline">Loading quiz…</p></div>;
  if (status === "error") return <div className="quiz-panel"><p className="empty-inline">This quiz could not be loaded.</p></div>;

  return (
    <div className="quiz-panel">
      <div className="quiz-head">
        <div>
          <span className="eyebrow">Auto-graded</span>
          <h2>{title}</h2>
        </div>
        <span className="quiz-pass">Pass mark {passScore}%</span>
      </div>

      {result && (
        <div className={`quiz-result ${result.passed ? "pass" : "fail"}`}>
          <strong>
            {result.passed ? "Passed" : "Not passed"} · {result.score}/{result.total} ({result.percent}%)
          </strong>
          <span>{result.passed ? "The quiz lesson is now marked complete." : "Review the answers below and try again."}</span>
        </div>
      )}

      {questions.map((question, index) => {
        const review = result?.review[index];
        return (
          <fieldset className="quiz-question" key={question.prompt}>
            <legend>
              {index + 1}. {question.prompt}
            </legend>
            <div className="quiz-options">
              {question.options.map((option, optionIndex) => {
                const chosen = answers[index] === optionIndex;
                const isCorrect = review && review.correctIndex === optionIndex;
                const isWrongPick = review && review.chosen === optionIndex && review.chosen !== review.correctIndex;
                return (
                  <label
                    key={option}
                    className={`${chosen ? "chosen" : ""} ${isCorrect ? "correct" : ""} ${isWrongPick ? "wrong" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`quiz-${index}`}
                      checked={chosen}
                      disabled={Boolean(result)}
                      onChange={() =>
                        setAnswers((prev) => {
                          const next = [...prev];
                          next[index] = optionIndex;
                          return next;
                        })
                      }
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {message && <p className="profile-status" role="status">{message}</p>}

      <div className="quiz-actions">
        {result ? (
          <button className="primary-button" type="button" onClick={retry}>
            Try again <span>→</span>
          </button>
        ) : (
          <button
            className="primary-button"
            type="button"
            onClick={submit}
            disabled={answeredCount < questions.length || status === "submitting"}
          >
            {status === "submitting" ? "Submitting…" : `Submit answers (${answeredCount}/${questions.length})`} <span>→</span>
          </button>
        )}
      </div>
    </div>
  );
}
