const pistonLanguages = {
  python: { language: "python", version: "3.10.0" },
  c: { language: "c", version: "10.2.0" },
  cpp: { language: "c++", version: "10.2.0" },
  java: { language: "java", version: "15.0.2" },
};

const judgeLanguages = { python: 109, c: 103, cpp: 105, java: 91 };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function processCandidatesForLanguage(language) {
  if (language === "java") return "Main.java";
  if (language === "python") return "main.py";
  if (language === "cpp") return "main.cpp";
  return "main.c";
}

async function runWithPiston(target, token, language, code, stdin, signal) {
  const response = await fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      ...pistonLanguages[language],
      files: [{ name: processCandidatesForLanguage(language), content: code }],
      stdin,
      run_timeout: 5000,
      compile_timeout: 10000,
    }),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? "The compiler rejected the program.");
  const compileOutput = result.compile?.output ?? result.compile?.stderr ?? "";
  const runOutput = result.run?.output ?? `${result.run?.stdout ?? ""}${result.run?.stderr ?? ""}`;
  return {
    output: `${compileOutput}${runOutput}` || "Program finished without output.",
    mode: "Piston sandbox",
    status: result.run?.code === 0 ? "Completed" : "Runtime error",
    exitCode: result.run?.code ?? result.compile?.code ?? null,
    signal: result.run?.signal ?? null,
  };
}

async function runWithJudge0(target, token, language, code, stdin, signal) {
  const headers = { "content-type": "application/json", ...(token ? { "x-auth-token": token } : {}) };
  const submissionUrl = new URL("/submissions?base64_encoded=false&wait=false", target);
  const created = await fetch(submissionUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ source_code: code, language_id: judgeLanguages[language], stdin, cpu_time_limit: 3, wall_time_limit: 6, memory_limit: 128000 }),
    signal,
  });
  const createdResult = await created.json();
  if (!created.ok || !createdResult.token) {
    throw new Error(createdResult.message ?? createdResult.error ?? "The compiler could not start this program.");
  }
  const resultUrl = new URL(
    `/submissions/${encodeURIComponent(createdResult.token)}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory,exit_code,exit_signal`,
    target
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await wait(350);
    const response = await fetch(resultUrl, { headers, signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "The compiler could not return the result.");
    if ((result.status?.id ?? 0) > 2) {
      const output = [result.compile_output, result.stdout, result.stderr, result.message].filter(Boolean).join("").trimEnd();
      return {
        output: output || "Program finished without output.",
        mode: "Judge0 sandbox",
        status: result.status?.description ?? "Completed",
        time: result.time ?? null,
        memory: result.memory ?? null,
        exitCode: result.exit_code ?? null,
        signal: result.exit_signal ?? null,
      };
    }
  }
  throw new Error("Execution is still queued. Please run the program again.");
}

export async function executeCode({ language, code, stdin }) {
  const target = new URL(process.env.CODE_RUNNER_URL || "https://ce.judge0.com");
  if (target.protocol !== "https:") throw new Error("The code runner must use HTTPS.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const isPiston = target.pathname.includes("piston") || target.pathname.endsWith("/execute");
    const result = isPiston
      ? await runWithPiston(target, process.env.CODE_RUNNER_TOKEN || "", language, code, stdin ?? "", controller.signal)
      : await runWithJudge0(target, process.env.CODE_RUNNER_TOKEN || "", language, code, stdin ?? "", controller.signal);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
