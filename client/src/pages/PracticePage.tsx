import { useState } from "react";
import { api } from "../api/client";
import type { Language, RunMeta } from "../types";
import { codeSamples, quizQuestions } from "../data/constants";

export default function PracticePage() {
  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState(codeSamples.python);
  const [standardInput, setStandardInput] = useState("Ajay\nloops");
  const [output, setOutput] = useState("Run your code to see the output here.");
  const [runMeta, setRunMeta] = useState<RunMeta>({ status: "Ready", mode: "Secure cloud sandbox", durationMs: 0 });
  const [running, setRunning] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);

  function changeLanguage(next: Language) {
    setLanguage(next);
    setCode(codeSamples[next]);
    setStandardInput(next === "python" ? "Ajay\nloops" : "Ajay");
    setOutput("Run your code to see the output here.");
    setRunMeta({ status: "Ready", mode: "Secure cloud sandbox", durationMs: 0 });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void runCode();
      return;
    }
    if (event.key !== "Tab") return;
    event.preventDefault();
    const editor = event.currentTarget;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    setCode(`${code.slice(0, start)}  ${code.slice(end)}`);
    requestAnimationFrame(() => { editor.selectionStart = editor.selectionEnd = start + 2; });
  }

  async function runCode() {
    if (!code.trim()) {
      setOutput("Write some code before running it.");
      setRunMeta({ status: "No code", mode: "Editor", durationMs: 0 });
      return;
    }
    setRunning(true);
    setOutput("Compiling and running your program…");
    setRunMeta({ status: "Running", mode: "Secure cloud sandbox", durationMs: 0 });
    try {
      const data = await api.runCode(language, code, standardInput);
      setOutput(data.output || "Program finished without output.");
      setRunMeta({ status: data.status, mode: data.mode, durationMs: data.durationMs, time: data.time, memory: data.memory });
    } catch (err) {
      setOutput(err instanceof Error ? err.message : "The runner is temporarily unavailable. Try again.");
      setRunMeta({ status: "Failed", mode: "Runner unavailable", durationMs: 0 });
    } finally {
      setRunning(false);
    }
  }

  function submitQuiz() {
    const score = quizQuestions.reduce((total, item, index) => total + (quizAnswers[index] === item.answer ? 1 : 0), 0);
    setQuizScore(score);
  }

  return (
    <div className="page-content practice-page">
      <section className="page-intro">
        <span className="eyebrow accent">Practice studio</span>
        <h1>Think it. Run it. Learn it.</h1>
        <p>Experiment safely in C, C++, Python, or Java, then test your understanding.</p>
      </section>
      <div className="practice-grid">
        <section className="code-card">
          <div className="code-toolbar">
            <div className="language-tabs">
              {(["python", "c", "cpp", "java"] as Language[]).map((item) => (
                <button type="button" key={item} className={language === item ? "active" : ""} onClick={() => changeLanguage(item)}>
                  {item === "cpp" ? "C++" : item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
            <span className={`runner-status ${running ? "running" : ""}`}><i />{runMeta.mode}</span>
            <button className="run-button" type="button" onClick={runCode} disabled={running}>{running ? "Compiling…" : "▶ Run"}</button>
          </div>
          <div className="editor-subtoolbar">
            <span>{language === "python" ? "main.py" : language === "java" ? "Main.java" : language === "cpp" ? "main.cpp" : "main.c"}</span>
            <div>
              <button type="button" onClick={() => { setCode(codeSamples[language]); setOutput("Starter code restored. Press Run when ready."); }}>Reset</button>
              <button type="button" onClick={() => void navigator.clipboard.writeText(code)}>Copy code</button>
              <kbd>⌘ Enter</kbd>
            </div>
          </div>
          <textarea
            className="code-editor"
            spellCheck={false}
            aria-label={`${language} code editor`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="stdin-panel">
            <label htmlFor="standard-input">Standard input</label>
            <textarea id="standard-input" value={standardInput} onChange={(e) => setStandardInput(e.target.value)} placeholder="Enter each input value on a new line" />
          </div>
          <div className={`console ${runMeta.status.toLowerCase().includes("error") || runMeta.status.toLowerCase().includes("failed") ? "has-error" : ""}`}>
            <div><span>OUTPUT <b>{runMeta.status}</b></span>
              <div className="console-meta">
                {runMeta.time && <em>{runMeta.time}s</em>}
                {runMeta.memory != null && <em>{Math.round(runMeta.memory / 1024)} MB</em>}
                {runMeta.durationMs > 0 && <em>{(runMeta.durationMs / 1000).toFixed(2)}s total</em>}
              </div>
            </div>
            <pre>{output}</pre>
          </div>
        </section>
        <section className="challenge-card">
          <span className="eyebrow">Daily challenge</span>
          <h2>Greeting formatter</h2>
          <p>Change the program so it prints your name and a second line with your learning goal.</p>
          <div className="challenge-meta"><span>Easy</span><span>+20 XP</span><span>8 min</span></div>
          <h3>Expected shape</h3>
          <pre>Hello, Ajay!{"\n"}Today I will learn loops.</pre>
          <button className="outline-button" onClick={() => setCode(codeSamples[language])}>Reset starter code</button>
        </section>
      </div>
      <section className="quiz-card">
        <div className="quiz-head">
          <div><span className="eyebrow">Knowledge check</span><h2>Python foundations quiz</h2></div>
          {quizScore !== null && <div className="score-badge"><strong>{quizScore}/{quizQuestions.length}</strong><span>{quizScore === quizQuestions.length ? "Excellent" : "Keep practicing"}</span></div>}
        </div>
        {quizQuestions.map((item, index) => (
          <fieldset key={item.q}>
            <legend><span>{index + 1}</span>{item.q}</legend>
            <div className="answer-grid">
              {item.options.map((option, optionIndex) => (
                <label className={quizScore !== null && optionIndex === item.answer ? "correct" : ""} key={option}>
                  <input type="radio" name={`q-${index}`} checked={quizAnswers[index] === optionIndex}
                    onChange={() => { setQuizAnswers((cur) => ({ ...cur, [index]: optionIndex })); setQuizScore(null); }} />
                  <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button className="primary-button" onClick={submitQuiz} disabled={Object.keys(quizAnswers).length < quizQuestions.length}>Submit answers <span>→</span></button>
      </section>
    </div>
  );
}
