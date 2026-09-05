import { executeCode } from "../services/codeRunner.js";

const pistonLanguages = { python: true, c: true, cpp: true, java: true };

export async function runCode(req, res) {
  const startedAt = Date.now();
  try {
    const language = String(req.body.language ?? "").toLowerCase();
    const code = String(req.body.code ?? "");
    const stdin = String(req.body.stdin ?? "");
    if (!pistonLanguages[language]) return res.status(400).json({ error: "Choose a supported language." });
    if (!code.trim()) return res.status(400).json({ error: "Write some code before running it." });
    if (code.length > 20000) return res.status(413).json({ error: "Code is limited to 20,000 characters." });
    if (stdin.length > 10000) return res.status(413).json({ error: "Standard input is limited to 10,000 characters." });

    const result = await executeCode({ language, code, stdin });
    res.json({ ...result, durationMs: Date.now() - startedAt });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Execution timed out after 12 seconds."
        : error.message;
    res.status(500).json({ error: message, status: "Failed", durationMs: Date.now() - startedAt });
  }
}
