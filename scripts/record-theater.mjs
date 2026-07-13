#!/usr/bin/env node
// [INPUT]: depends on playwright (devDependency, chromium only) to drive a real browser tab
//   through waves/wave-NN/theater.html, node:http to serve that wave's directory (theater.html's
//   rollout <video> tags need a real origin, file:// blocks relative video loads in Chromium's
//   autoplay path more often than it allows them), node:child_process to shell out to the
//   system ffmpeg for the one mechanical step (webm -> mp4, no filters, this machine's ffmpeg
//   build carries no drawtext)
// [OUTPUT]: waves/wave-NN/theater-waveNN.mp4, a real screen recording of the theater replay
//   playing end to end
// [POS]: the recording half of the "Theater, the showing" station documented in skill/SKILL.md
//   and skill/CODEX.md; scripts/machine.mjs theater renders the page, this script performs it
//   and captures the performance. Run after `machine.mjs theater` has already written
//   theater.html for the target wave.
// [PROTOCOL]: update this header on change, then check CLAUDE.md
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat, rename, rm, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

function waveDirName(waveNumber) {
  return `wave-${String(waveNumber).padStart(2, "0")}`;
}

// A minimal static file server scoped to one wave's directory: theater.html
// references its rollout mp4s by a path relative to itself, and Chromium's
// autoplay-muted-video path is far more reliably permitted over http:// than
// file://, where relative video src resolution has been flaky in practice.
function serveDir(rootDir) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const filePath = path.join(rootDir, urlPath === "/" ? "/theater.html" : urlPath);
        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403);
          res.end("forbidden");
          return;
        }
        const ext = path.extname(filePath);
        const body = await readFile(filePath);
        res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream" });
        res.end(body);
      } catch (err) {
        res.writeHead(404);
        res.end("not found: " + err.message);
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      wave: { type: "string", default: "4" },
      speed: { type: "string", default: "1" },
      timeout: { type: "string", default: "180000" },
    },
  });

  const waveNumber = Number(values.wave);
  const speed = values.speed;
  const timeoutMs = Number(values.timeout);
  const dirName = waveDirName(waveNumber);
  const waveDir = path.join(REPO_ROOT, "waves", dirName);
  const theaterPath = path.join(waveDir, "theater.html");

  if (!existsSync(theaterPath)) {
    console.error(`[record-theater] ${theaterPath} does not exist. Run \`node scripts/machine.mjs theater\` for wave ${waveNumber} first.`);
    process.exitCode = 1;
    return;
  }

  // record-theater serves the repo root, not just the wave dir, because
  // theater.html's rollout <video> src values are relative paths that walk
  // up to waves/wave-NN/assets/rollout/... (mirroring report.html's own
  // path.relative(waveDir, ...) convention), so the server root must be a
  // common ancestor of theater.html and every asset it references.
  const server = await serveDir(REPO_ROOT);
  const { port } = server.address();
  const pageURL = `http://127.0.0.1:${port}/waves/${dirName}/theater.html?speed=${encodeURIComponent(speed)}`;

  const videoDir = await mkdtemp(path.join(os.tmpdir(), "theater-record-"));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();

  console.log(`[record-theater] navigating to ${pageURL}`);
  await page.goto(pageURL, { waitUntil: "load" });

  console.log(`[record-theater] waiting for body[data-done="1"] (timeout ${timeoutMs}ms)`);
  await page.waitForSelector('body[data-done="1"]', { timeout: timeoutMs });
  console.log("[record-theater] playback finished, closing capture");

  // A short settle so the final frame (the install hook / closing line) is
  // actually captured before the recorder stops, not cut off mid-frame.
  await page.waitForTimeout(800);

  const videoHandle = page.video();
  await context.close();
  await browser.close();
  server.close();

  const webmPath = await videoHandle.path();
  const mp4Name = `theater-${dirName.replace("wave-", "wave")}.mp4`;
  const mp4Path = path.join(waveDir, mp4Name);

  console.log(`[record-theater] transcoding ${webmPath} -> ${mp4Path} (no filters, this machine's ffmpeg has no drawtext)`);
  const ffmpegResult = spawnSync(
    "ffmpeg",
    ["-y", "-i", webmPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4Path],
    { stdio: "inherit" }
  );
  if (ffmpegResult.status !== 0) {
    console.error("[record-theater] ffmpeg transcode failed");
    process.exitCode = 1;
    return;
  }

  const stats = await stat(mp4Path);
  console.log(`[record-theater] wrote ${mp4Path} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  await rm(videoDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("[record-theater] fatal:", err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
