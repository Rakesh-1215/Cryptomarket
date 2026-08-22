const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_VENV_PYTHON = path.join(__dirname, "..", "..", ".venv", "Scripts", "python.exe");
const BACKEND_VENV_PYTHON = path.join(__dirname, "..", ".venv", "Scripts", "python.exe");
const CODEX_RUNTIME_PYTHON =
  "C:\\Users\\rakesh\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

let cachedPythonBin = null;

function canRunPython(pythonBin) {
  if (!pythonBin || !fs.existsSync(pythonBin)) return false;

  const probe = spawnSync(
    pythonBin,
    [
      "-c",
      "import numpy, pandas, sklearn, xgboost; print('ok')",
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15000,
    },
  );

  return probe.status === 0 && /ok/.test(`${probe.stdout || ""}${probe.stderr || ""}`);
}

function resolvePythonBin() {
  if (cachedPythonBin) return cachedPythonBin;

  const envBin = process.env.PYTHON_BIN;
  const candidates = [
    envBin,
    ROOT_VENV_PYTHON,
    BACKEND_VENV_PYTHON,
    CODEX_RUNTIME_PYTHON,
    "python",
  ];

  for (const candidate of candidates) {
    if (canRunPython(candidate)) {
      cachedPythonBin = candidate;
      return cachedPythonBin;
    }
  }

  cachedPythonBin = envBin || ROOT_VENV_PYTHON || CODEX_RUNTIME_PYTHON || "python";
  return cachedPythonBin;
}

module.exports = {
  resolvePythonBin,
};
