import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "app");
const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(dataDir, "uploads");
const stemDir = path.join(dataDir, "stems");
const binDir = path.join(dataDir, "bin");
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const demucsEnv = {
  ...process.env,
  PATH: `${binDir}:${process.env.PATH || ""}`
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function safeName(name) {
  return name.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "") || "track.mp3";
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
      }
    });
  });
}

async function demucsAvailable() {
  try {
    await run("python3", ["-c", "import demucs, soundfile"], { cwd: __dirname, env: demucsEnv });
    return true;
  } catch {
    return false;
  }
}

async function handleStemSeparation(req, res) {
  if (!(await demucsAvailable())) {
    sendJson(res, 503, {
      error: "Demucs dependencies are missing. Install them with: python3 -m pip install demucs soundfile static-ffmpeg"
    });
    return;
  }

  const request = new Request(`http://localhost:${port}/api/stem-separate`, {
    method: "POST",
    headers: req.headers,
    body: req,
    duplex: "half"
  });
  const form = await request.formData();
  const file = form.get("audio");

  if (!file || typeof file === "string") {
    sendJson(res, 400, { error: "No audio file was uploaded." });
    return;
  }

  await mkdir(uploadDir, { recursive: true });
  await mkdir(stemDir, { recursive: true });

  const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const originalName = safeName(file.name || "track.mp3");
  const inputPath = path.join(uploadDir, `${jobId}-${originalName}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(inputPath, bytes);

  try {
    await run("python3", ["pulse_demucs.py", "-n", "htdemucs", "--out", stemDir, inputPath], {
      cwd: __dirname,
      env: demucsEnv
    });
  } catch (error) {
    sendJson(res, 500, { error: `Demucs failed: ${error.message.slice(0, 600)}` });
    return;
  }

  const baseName = path.basename(inputPath, path.extname(inputPath));
  const modelPath = path.join(stemDir, "htdemucs", baseName);
  const stems = {};

  for (const stem of ["vocals", "drums", "bass", "other"]) {
    const outputPath = path.join(modelPath, `${stem}.wav`);
    try {
      await stat(outputPath);
      stems[stem] = `/stems/htdemucs/${encodeURIComponent(baseName)}/${stem}.wav`;
    } catch {
      sendJson(res, 500, { error: `Missing ${stem}.wav from Demucs output.` });
      return;
    }
  }

  sendJson(res, 200, {
    title: originalName.replace(/\.[^/.]+$/, ""),
    stems
  });
}

async function serveFile(res, baseDir, requestPath) {
  const cleanPath = decodeURIComponent(requestPath.split("?")[0]);
  const filePath = path.normalize(path.join(baseDir, cleanPath));

  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error("Not a file");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/stem-separate") {
      await handleStemSeparation(req, res);
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }

    if (req.url?.startsWith("/stems/")) {
      await serveFile(res, stemDir, req.url.replace(/^\/stems\//, ""));
      return;
    }

    const requestPath = req.url === "/" ? "/index.html" : req.url || "/index.html";
    await serveFile(res, appDir, requestPath);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

await mkdir(dataDir, { recursive: true });
server.listen(port, host, () => {
  console.log(`PULSE Music running at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
});
