/**
 * [INPUT]: depends on theater.ts's exported THEATER_CSS and on wave files discovered over http:
 *   live-log.jsonl, brief-v{1,2,3}.json, variants.json, named-assets.json, plan.json, assets/,
 *   assets/rollout/, and readout.json
 * [OUTPUT]: exports renderTheaterLive(waveNumber) -> string, a self-contained live workbench that
 *   polls every two seconds and renders mission-card, triptych, produce-shelf with judge-stamps,
 *   thresholded race-card, hero-card, rollout-shelves, bill-card, chapter headers, lightbox, and
 *   the next-station empty state as the wave lands
 * [POS]: the real-time twin of theater.ts's finished-wave replay. It preserves the station 1 and
 *   station 8b approval overlays and the file-driven polling contract while using the replay's
 *   final evidence components. Live images stay as relative asset paths because this page runs
 *   against an http-served wave directory rather than baked data URIs.
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { THEATER_CSS } from "./theater.js";

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTheaterLive(waveNumber: number): string {
  const waveLabel = String(waveNumber).padStart(2, "0");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>The Growth Machine, Live &middot; wave ${escapeHTML(waveLabel)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${THEATER_CSS}
${LIVE_EXTRA_CSS}
</style>
</head>
<body>
  <div class="theater" id="theater">
    <header class="topbar">
      <span class="topbar-word">The Growth Machine, live</span>
      <ol class="topbar-stations" id="topbarStations">
        <li data-key="open" title="open"></li>
        <li data-key="insight" title="insight"></li>
        <li data-key="naming" title="naming"></li>
        <li data-key="plan" title="plan"></li>
        <li data-key="produce" title="produce"></li>
        <li data-key="judge" title="judge"></li>
        <li data-key="race" title="simulate + decide"></li>
        <li data-key="cut" title="the cut"></li>
        <li data-key="rollout" title="rollout + learn"></li>
      </ol>
    </header>

    <div class="workspace">
      <section class="panel panel-work">
        <div class="panel-heading">The Work</div>
        <div class="log-stream" id="logStream"></div>
      </section>
      <section class="panel panel-evidence">
        <div class="panel-heading">The Evidence</div>
        <div class="evidence-stack" id="evidenceStack"></div>
        <div class="awaiting-state" id="awaitingState"></div>
      </section>
    </div>

    <footer class="bottombar">
      <div class="bottombar-fill" id="progressFill"></div>
      <div class="bottombar-caption">live: watching wave ${escapeHTML(waveLabel)} as it runs</div>
    </footer>

    <div class="approval-gate" id="approvalGate">
      <div class="approval-gate-text">awaiting operator approval</div>
    </div>

    <div class="lightbox" id="lightbox" hidden>
      <div class="lightbox-panel">
        <div class="lightbox-media" id="lightboxMedia"></div>
        <p class="lightbox-note" id="lightboxNote"></p>
        <p class="lightbox-hint">press space or click outside to close</p>
      </div>
    </div>
  </div>

<script>
window.__LIVE_WAVE__ = ${JSON.stringify(waveNumber)};
</script>
<script>
${LIVE_JS}
</script>
</body>
</html>`;
}

const LIVE_EXTRA_CSS = `
.file-note { border: 1px solid var(--hairline); padding: 16px 18px; font-size: 13px; }
.serve-hint { font-family: var(--font-mono); font-size: 12px; background: #f7f6f3; border: 1px solid var(--hairline); padding: 8px 10px; margin-top: 10px; }
.awaiting-state {
  flex: 0 0 auto; margin: 0 18px; padding: 10px 0 12px; border-top: 1px solid var(--hairline);
  font-size: 9px; font-weight: 500; letter-spacing: 0.13em; text-transform: uppercase; color: var(--muted);
}
.awaiting-state[hidden] { display: none; }
.rollout-details { margin-top: 7px; font-size: 10px; line-height: 1.4; color: var(--muted); }
.participation-note { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--hairline); }
.lightbox .produce-thumb, .lightbox .rollout-cell { opacity: 1; transform: none; }
`;

// ============================================================
// JS: a 2s poll loop. No pre-baked data and no TIMELINE; the wave itself is
// the pacing. Two independent concerns, deliberately
// kept apart: which FILES exist (drives every card in the right column,
// always) and which TEXT narrates the left column (live-log.jsonl when the
// wave process is writing one, otherwise inferred one-line-per-file-event
// fallback). directory listings are parsed from the plain <a href="..."> the
// stdlib http.server directory index emits, so new asset filenames don't
// need to be known in advance.
// ============================================================
const LIVE_JS = `
(function () {
  "use strict";
  var WAVE = window.__LIVE_WAVE__;
  var WAVE_LABEL = String(WAVE).padStart(2, "0");
  var POLL_MS = 2000;
  var ANGLE_COLOR = { moment: "#c2410c", evergreen: "#2f6b6b", "ugc-loop": "#6b4fa0" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function readString(obj, key) {
    return obj && typeof obj === "object" && typeof obj[key] === "string" ? obj[key] : null;
  }

  var logStream = document.getElementById("logStream");
  var evidenceStack = document.getElementById("evidenceStack");
  var awaitingState = document.getElementById("awaitingState");

  function logLine(text, isHeader) {
    var line = el("div", "log-line" + (isHeader ? " header" : ""), esc(text));
    logStream.appendChild(line);
    logStream.scrollTop = logStream.scrollHeight;
  }

  function addCard(card, evidenceNote) {
    if (evidenceNote) { card.setAttribute("data-evidence", "1"); card.dataset.evidenceNote = evidenceNote; }
    evidenceStack.appendChild(card);
    requestAnimationFrame(function () {
      card.classList.add("in");
      card.scrollIntoView({ block: "start" });
    });
    return card;
  }

  var chaptersSeen = {};
  function addChapter(index, line) {
    if (chaptersSeen[index]) return;
    chaptersSeen[index] = true;
    var c = el("article", "evidence-card chapter");
    c.innerHTML = '<span class="chapter-index">' + esc(index) + '</span><p class="chapter-line">' + esc(line) + '</p>';
    addCard(c);
  }

  function countUp(target, to, ms) {
    if (!target) return;
    var started = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - started) / ms);
      target.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
      else target.textContent = String(Math.round(to));
    })(started);
  }

  function typewriter(target, text, ms) {
    var i = 0;
    var per = Math.max(10, ms / Math.max(1, text.length));
    target.innerHTML = '<span class="cursor"></span>';
    (function tick() {
      i++;
      target.innerHTML = esc(text.slice(0, i)) + '<span class="cursor"></span>';
      if (i < text.length) setTimeout(tick, per);
    })();
  }

  var STAGE_KEYS = ["open", "insight", "naming", "plan", "produce", "judge", "race", "cut", "rollout"];
  var STAGE_LABELS = ["open", "station 1 / insight", "station 3 / naming", "station 4 / plan", "station 5 / produce", "station 6 / judge", "station 7 / simulate + decide", "the cut", "station 8b / rollout"];
  var currentStageIndex = -1;
  function showStage(key) {
    var idx = STAGE_KEYS.indexOf(key);
    if (idx < 0) return;
    if (idx < currentStageIndex) return;
    currentStageIndex = idx;
    document.getElementById("progressFill").style.width = (((idx + 1) / STAGE_KEYS.length) * 100).toFixed(2) + "%";
    document.querySelectorAll("#topbarStations li").forEach(function (li) {
      var liIdx = STAGE_KEYS.indexOf(li.getAttribute("data-key"));
      li.classList.toggle("done", liIdx < idx);
      li.classList.toggle("active", liIdx === idx);
    });
    var next = STAGE_LABELS[idx + 1];
    awaitingState.textContent = next ? "awaiting " + next : "awaiting wave completion";
  }

  if (location.protocol === "file:") {
    logLine("$ growth-machine wave " + WAVE_LABEL, true);
    var note = el("div", "file-note");
    note.innerHTML = "live mode polls files over http, file:// cannot fetch(). serve the repo root, then reopen this page over http." +
      '<div class="serve-hint">$ python3 -m http.server 8000<br>then open http://localhost:8000/waves/wave-' + WAVE_LABEL + '/live.html</div>';
    logStream.appendChild(note);
    return;
  }

  async function getJSON(path) {
    try {
      var res = await fetch(path, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }
  async function getText(path) {
    try {
      var res = await fetch(path, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.text();
    } catch (e) {
      return null;
    }
  }
  // Parses the plain <a href="..."> directory index emitted by
  // \`python3 -m http.server\` (and most static file servers with listings
  // on). Filters out parent-dir links and sub-directories.
  async function listDir(path) {
    var html = await getText(path);
    if (!html) return [];
    var hrefs = [];
    var re = /<a href="([^"]+)">/g;
    var m;
    while ((m = re.exec(html))) hrefs.push(decodeURIComponent(m[1]));
    return hrefs.filter(function (h) { return h !== "../" && !h.endsWith("/") && !h.startsWith("?"); });
  }

  var seenBriefs = {};
  var seenAssets = {};
  var pendingAssets = {};
  var seenRollout = {};
  var liveLogMode = false;
  var liveLogLinesSeen = 0;
  var readoutLoaded = false;
  var planLoaded = false;
  var variantsData = null;
  var namedAssetsData = null;

  function inferredLog(text) { logLine(text, false); }

  function showApprovalGate(text) {
    var gate = document.getElementById("approvalGate");
    gate.querySelector(".approval-gate-text").textContent = text || "awaiting operator approval";
    gate.classList.add("show");
  }
  function hideApprovalGate() { document.getElementById("approvalGate").classList.remove("show"); }

  // The human approval gates, live-mode version. skill/SKILL.md documents
  // two: station 1 (concept proposals, kind unset or "concepts") pauses
  // after insight until the operator approves or replaces the three
  // proposals; station 8b (kind:"video-spend") pauses again before any
  // video generation is submitted, because video spends a paid API budget
  // and stills do not. The agent running a wave appends
  // {type:"proposal", ...} then waits, then appends
  // {type:"decision", line:"..."} once the operator has actually decided.
  // This function only renders that pause, it does not enforce it --
  // enforcement is the agent's obligation, documented in the skill contract.
  function renderProposalEvent(entry) {
    if (entry.kind === "video-spend") {
      showStage("rollout");
      logLine((entry.detail || "video generation pending"), false);
      showApprovalGate("video generation awaiting approval, real spend");
      return;
    }
    showStage("insight");
    var variants = entry.variants || [];
    addChapter("Act I", variants.length
      ? "The machine drafts " + variants.length + " creative bets from one seed."
      : "The machine drafts creative bets from one seed.");
    if (variants.length) {
      var row = el("article", "evidence-card tier1 triptych");
      variants.forEach(function (v, i) {
        var color = ANGLE_COLOR[v.angleType] || "#1a1a1a";
        var cell = el("div", "triptych-cell");
        cell.innerHTML = '<div class="triptych-num" style="color:' + color + '">Bet ' + String(i + 1).padStart(2, "0") + '</div>' +
          '<div class="triptych-title">' + esc(v.workingTitle || "") + '</div>' +
          '<p class="triptych-formula"><b>' + esc(v.asset || "") + '</b><span class="x">&times;</span><b>' + esc(v.newElement || "") + '</b></p>' +
          '<span class="triptych-angle" style="color:' + color + '">' + esc(v.angleType || "") + '</span>';
        row.appendChild(cell);
        requestAnimationFrame(function () { cell.classList.add("in"); });
      });
      addCard(row, "the proposal set from live-log.jsonl, one bet per angle type");
    }
    logLine("awaiting operator approval", false);
    showApprovalGate("awaiting operator approval");
  }

  function renderDecisionEvent(entry) {
    hideApprovalGate();
    if (entry.line) logLine(entry.line, false);
  }

  // The mission card, live-mode version: the agent starting a wave knows
  // the moment before insight even runs, so it appends this as the very
  // first live-log.jsonl entry, {type:"mission", moment, objective}, ahead
  // of the proposal event. Live mode has no baked readout at generation
  // time to pull moment/plan.rationale from the way replay mode does, so
  // this event is how the brief still gets shown before the work starts.
  function renderMissionEvent(entry) {
    showStage("open");
    var c = el("article", "evidence-card tier1 mission-card");
    c.innerHTML = '<div class="evidence-eyebrow">the input &middot; one seed goes in</div>' +
      '<div class="evidence-title">' + esc(entry.moment || "") + '</div>' +
      '<p class="evidence-caption">' + esc(entry.objective || "") + '</p>';
    addCard(c, "mission event, live-log.jsonl");
  }

  async function pollLiveLog() {
    var text = await getText("live-log.jsonl");
    if (!text) return false;
    var lines = text.split("\\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length === 0) return false;
    liveLogMode = true;
    for (var i = liveLogLinesSeen; i < lines.length; i++) {
      try {
        var entry = JSON.parse(lines[i]);
        if (entry.type === "mission") renderMissionEvent(entry);
        else if (entry.type === "proposal") renderProposalEvent(entry);
        else if (entry.type === "decision") renderDecisionEvent(entry);
        else logLine(entry.line, /^station|^\\$/i.test(entry.line || ""));
      } catch (e) {
        // malformed line, skip rather than break the whole feed
      }
    }
    liveLogLinesSeen = lines.length;
    return true;
  }

  function channelTokenToName(token) {
    var map = { TT: "tiktok", IG: "instagram", XTW: "x", APP: "in-app profile surface" };
    return map[token] || token.toLowerCase();
  }

  async function pollBriefs() {
    for (var i = 1; i <= 3; i++) {
      if (seenBriefs["v" + i]) continue;
      var brief = await getJSON("brief-v" + i + ".json");
      if (!brief) continue;
      seenBriefs["v" + i] = true;
      if (liveLogMode) continue;
      inferredLog("brief-v" + i + ".json written: " + (brief.assetXElement || brief.workingTitle || "v" + i));
      if (brief.referenceSet && brief.referenceSet.source) {
        inferredLog("consulting " + brief.referenceSet.source + ", " + (brief.referenceSet.status || "") + ": " + (brief.referenceSet.note || ""));
      }
      showStage("insight");
      addChapter("Act I", "The machine drafts creative bets from one seed.");
      var c = el("article", "evidence-card");
      c.innerHTML = '<div class="evidence-eyebrow">' + esc(brief.workingTitle || "v" + i) + '</div>' +
        '<p class="evidence-caption">' + esc(brief.assetXElement || "") + '</p>' +
        '<p class="evidence-caption">' + esc(brief.insight || "") + '</p>';
      addCard(c, "brief-v" + i + ".json, audience: " + (brief.audience || ""));
    }
  }

  async function pollPlan() {
    if (planLoaded) return;
    var plan = await getJSON("plan.json");
    if (!plan) return;
    planLoaded = true;
    if (!liveLogMode) inferredLog("plan.json written: thresholds locked, " + (plan.dates ? plan.dates.days : 21) + "-day window");
    showStage("plan");
    var angles = Object.keys(plan.preRegisteredThresholds || {});
    var rows = angles.map(function (a) {
      var t = plan.preRegisteredThresholds[a];
      return "<tr><td>" + a + "</td><td>" + (t.scaleAt * 100).toFixed(2) + "%</td><td>" + (t.killAt * 100).toFixed(2) + "%</td><td>" + t.fatigueSlope.toFixed(4) + "</td></tr>";
    }).join("");
    var c = el("article", "evidence-card tier3");
    c.innerHTML = '<div class="evidence-eyebrow">preregistered thresholds</div><table class="plan-table"><thead><tr><th>angle</th><th>scale at</th><th>kill at</th><th>fatigue</th></tr></thead><tbody>' + rows + "</tbody></table>";
    addCard(c, "plan.json, preRegisteredThresholds");
  }

  async function pollVariants() {
    if (variantsData) return;
    var data = await getJSON("variants.json");
    if (data && Array.isArray(data.variants)) variantsData = data.variants;
  }

  async function pollNamedAssets() {
    if (namedAssetsData) return;
    var data = await getJSON("named-assets.json");
    if (Array.isArray(data)) namedAssetsData = data;
  }

  var economicsLogged = false;
  var produceShelf = null;
  var produceBlocks = {};

  function resolveAsset(name) {
    if (!variantsData || !namedAssetsData) return null;
    var stem = name.replace(/\\.png$/i, "");
    var takeMatch = stem.match(/_(A|B)$/i);
    var heroVersion = takeMatch ? takeMatch[1].toUpperCase() : null;
    var baseName = takeMatch ? stem.slice(0, -2) : stem;
    var namedAsset = namedAssetsData.find(function (asset) {
      return asset.format === "still" && asset.name === baseName;
    });
    if (!namedAsset) return null;
    var variant = variantsData.find(function (candidate) { return candidate.id === namedAsset.variantId; });
    return variant ? { variant: variant, heroVersion: heroVersion } : null;
  }

  function ensureLiveVariantBlock(variant) {
    if (produceBlocks[variant.id]) return produceBlocks[variant.id];
    if (!produceShelf) {
      produceShelf = el("article", "evidence-card produce-shelf");
      addCard(produceShelf, "produced stills discovered from assets/, each from a real generation call");
    }
    var color = ANGLE_COLOR[variant.angleType] || "#1a1a1a";
    var block = el("section", "variant-block");
    block.id = "variant-block-" + variant.id;
    block.style.borderLeftColor = color;
    block.innerHTML = '<div class="variant-block-head"><div class="variant-block-title">' + esc(variant.workingTitle || variant.id) + '</div>' +
      '<span class="triptych-angle variant-block-angle" style="color:' + color + '">' + esc(variant.angleType || "") + '</span></div>' +
      '<div class="variant-block-assets"></div><div class="produce-thumb-copy" id="live-copy-' + variant.id + '"></div>';
    produceShelf.appendChild(block);
    produceBlocks[variant.id] = block;
    return block;
  }

  async function pollAssets() {
    var files = await listDir("assets/");
    var pngs = files.filter(function (f) { return f.toLowerCase().endsWith(".png"); });
    pngs.forEach(function (name) { if (!seenAssets[name]) pendingAssets[name] = true; });
    var queued = Object.keys(pendingAssets);
    for (var i = 0; i < queued.length; i++) {
      var name = queued[i];
      if (seenAssets[name]) continue;
      var resolved = resolveAsset(name);
      if (!resolved) continue;
      seenAssets[name] = true;
      delete pendingAssets[name];
      showStage("produce");
      addChapter("Act II", "The machine produces each bet as a finished asset, then scores its own output.");
      if (!liveLogMode && !economicsLogged) {
        economicsLogged = true;
        inferredLog("economics: stills via codex exec, subscription, no per-token bill; video generation gated behind operator approval");
      }
      if (!liveLogMode) inferredLog("generating " + name.replace(/\\.png$/, "") + " via codex exec");
      var block = ensureLiveVariantBlock(resolved.variant);
      var thumb = el("div", "produce-thumb");
      thumb.setAttribute("data-asset-name", name);
      var takeHTML = resolved.heroVersion ? '<span class="take-label">' + esc(resolved.heroVersion) + '</span>' : "";
      thumb.innerHTML = '<div class="produce-frame"><img src="assets/' + esc(name) + '" alt="' + esc(name) + '" />' + takeHTML + "</div>";
      block.querySelector(".variant-block-assets").appendChild(thumb);
      var img = thumb.querySelector("img");
      (function (currentThumb, currentImg) {
        if (currentImg) currentImg.addEventListener("load", function () { currentImg.classList.add("clear"); });
        requestAnimationFrame(function () {
          currentThumb.classList.add("in");
          if (currentImg) currentImg.classList.add("clear");
        });
      })(thumb, img);
      block.scrollIntoView({ block: "start" });
    }
  }

  var rolloutCells = [];
  var activeRolloutCellId = null;
  var rolloutLiveCard = null;

  function closeTile(cellId) {
    var item = rolloutCells.find(function (entry) { return entry.id === cellId; });
    if (!item) return;
    item.cell.classList.remove("is-open");
    var video = item.media && item.media.querySelector("video");
    if (video) {
      video.pause();
      try { video.currentTime = 0; } catch (e) {}
    }
    if (activeRolloutCellId === cellId) activeRolloutCellId = null;
  }

  function openTile(cellId) {
    if (activeRolloutCellId && activeRolloutCellId !== cellId) closeTile(activeRolloutCellId);
    var item = rolloutCells.find(function (entry) { return entry.id === cellId; });
    if (!item) return;
    item.cell.classList.add("is-open");
    activeRolloutCellId = cellId;
    if (item.videoRelSrc && item.media && !item.media.querySelector("video")) {
      var video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      if (item.coverSrc) video.poster = item.coverSrc;
      video.src = item.videoRelSrc;
      item.media.appendChild(video);
    }
    var playable = item.media && item.media.querySelector("video");
    if (playable) {
      try { playable.currentTime = 0; } catch (e) {}
      playable.play().catch(function () {});
    }
    item.cell.scrollIntoView({ block: "nearest" });
  }

  function bindRolloutCell(item) {
    rolloutCells.push(item);
    item.cell.addEventListener("click", function (event) {
      event.stopPropagation();
      if (item.cell.classList.contains("is-open")) closeTile(item.id);
      else openTile(item.id);
    });
    requestAnimationFrame(function () { item.cell.classList.add("in"); });
  }

  async function pollRollout() {
    var files = await listDir("assets/rollout/");
    var media = files.filter(function (f) { return /\\.(png|mp4)$/i.test(f) && !/_raw\\.mp4$/i.test(f); });
    for (var i = 0; i < media.length; i++) {
      var name = media[i];
      if (seenRollout[name]) continue;
      seenRollout[name] = true;
      showStage("rollout");
      var isCover = /_cover\\.png$/i.test(name);
      var assetKey = name.replace(/_cover\\.png$/i, "").replace(/\\.(png|mp4)$/i, "");
      var existing = rolloutCells.find(function (entry) { return entry.assetKey === assetKey; });
      if (isCover && existing) {
        existing.coverSrc = "assets/rollout/" + name;
        existing.media.innerHTML = '<img src="' + esc(existing.coverSrc) + '" alt="' + esc(name) + '" />';
        continue;
      }
      if (existing) continue;
      var token = name.split("_")[0];
      var channel = channelTokenToName(token);
      var isVideo = /\\.mp4$/i.test(name);
      if (!liveLogMode) inferredLog(isVideo ? "video rendered: " + name : "channel cut landing: " + channel);
      if (!rolloutLiveCard) {
        rolloutLiveCard = el("article", "evidence-card");
        rolloutLiveCard.id = "liveRolloutShelf";
        rolloutLiveCard.innerHTML = '<div class="evidence-eyebrow">the channel cuts &middot; arriving live</div><div class="rollout-shelf"></div>';
        addCard(rolloutLiveCard, "rollout assets discovered from assets/rollout/");
      }
      var cell = el("div", "rollout-cell");
      var id = "live-rollout-" + rolloutCells.length;
      cell.id = id;
      var mediaHTML = isVideo
        ? '<div class="rollout-chip-media"><span class="evidence-caption">video ready</span></div>'
        : '<div class="rollout-chip-media"><img src="assets/rollout/' + esc(name) + '" alt="' + esc(name) + '" /></div>';
      cell.innerHTML = mediaHTML + '<div class="rollout-meta"><div class="rollout-channel">' + esc(channel) + '</div><div class="evidence-name">' + esc(name) + '</div></div>';
      cell.setAttribute("data-evidence", "1");
      cell.dataset.evidenceNote = "assets/rollout/" + name;
      rolloutLiveCard.querySelector(".rollout-shelf").appendChild(cell);
      bindRolloutCell({ id: id, assetKey: assetKey, cell: cell, media: cell.querySelector(".rollout-chip-media"), coverSrc: null, videoRelSrc: isVideo ? "assets/rollout/" + name : null });
    }
  }

  function renderJudgeAndRace(readout) {
    showStage("judge");
    (readout.variants || []).forEach(function (v) {
      var named = (readout.namedAssets || []).find(function (n) { return n.variantId === v.id && n.format === "still"; });
      var judges = (readout.judged || []).filter(function (j) { return j.variantId === v.id && j.format === "still"; });
      judges.forEach(function (judge) {
        var heroVersion = readString(judge, "heroVersion");
        var filename = named ? named.name + (heroVersion ? "_" + heroVersion : "") + ".png" : "";
        var thumb = Array.from(document.querySelectorAll(".produce-thumb[data-asset-name]")).find(function (candidate) {
          return candidate.getAttribute("data-asset-name") === filename;
        });
        var dims = [["on brief", judge.score.onBrief], ["legible", judge.score.legible], ["shareable", judge.score.shareable]];
        if (judge.score.brandFit != null) dims.push(["brand fit", judge.score.brandFit]);
        if (thumb) {
          var frame = thumb.querySelector(".produce-frame");
          var stamp = el("div", "judge-stamp" + (judge.passed ? "" : " fail"), judge.passed ? "PASS" : "FAIL");
          frame.appendChild(stamp);
          requestAnimationFrame(function () { stamp.classList.add("in"); });
          var score = el("div", "judge-score", dims.map(function (d) { return d[0] + " " + d[1]; }).join(" &middot; "));
          thumb.appendChild(score);
          thumb.setAttribute("data-evidence", "1");
          thumb.dataset.evidenceNote = judge.notes || "";
        }
        if (!liveLogMode) inferredLog(v.id + (heroVersion ? " take " + heroVersion : "") + " judge: " +
          dims.map(function (d) { return d[0] + " " + d[1]; }).join(", ") + " -> " + (judge.passed ? "PASS" : "FAIL"));
      });

      var produced = (readout.produced || []).find(function (asset) {
        return asset.variantId === v.id && asset.format === "still" && typeof asset.copy === "string";
      });
      var copyTarget = document.getElementById("live-copy-" + v.id);
      if (produced && copyTarget) {
        if (!liveLogMode) inferredLog("copy: " + produced.copy);
        typewriter(copyTarget, '"' + produced.copy + '"', 1200);
      }
    });

    showStage("race");
    var planDays = readout.plan && readout.plan.dates ? readout.plan.dates.days : 0;
    var killCount = (readout.decided || []).filter(function (d) { return d.verdict === "KILL"; }).length;
    addChapter("Act III", (planDays ? "A " + planDays + " day simulation" : "A simulation") +
      " tests every bet against thresholds locked in advance" + (killCount ? " and kills the bets that miss them." : "."));
    var vbW = 680, vbH = 260, plotW = 604, padTop = 16, padBot = 22;
    var all = [];
    (readout.simulated || []).forEach(function (s) { all = all.concat(s.predictedCTR); });
    (readout.variants || []).forEach(function (v) {
      var threshold = readout.plan && readout.plan.preRegisteredThresholds
        ? readout.plan.preRegisteredThresholds[v.angleType]
        : null;
      if (threshold) { all.push(threshold.scaleAt); all.push(threshold.killAt); }
    });
    var max = Math.max.apply(null, all.concat([0.0001]));
    function toY(value) { return vbH - padBot - (value / max) * (vbH - padTop - padBot); }
    var thresholdParts = [];
    var seenLevels = {};
    (readout.variants || []).forEach(function (v) {
      var t = readout.plan && readout.plan.preRegisteredThresholds
        ? readout.plan.preRegisteredThresholds[v.angleType]
        : null;
      if (!t) return;
      [["scale", t.scaleAt], ["kill", t.killAt]].forEach(function (level) {
        var key = level[0] + ":" + level[1].toFixed(4);
        if (seenLevels[key]) return;
        seenLevels[key] = true;
        var y = toY(level[1]).toFixed(1);
        var color = ANGLE_COLOR[v.angleType] || "#1a1a1a";
        thresholdParts.push('<line class="threshold-line" x1="0" y1="' + y + '" x2="' + plotW + '" y2="' + y + '" stroke="' + color + '"/>' +
          '<text class="threshold-label" x="' + (plotW + 6) + '" y="' + (Number(y) + 3).toFixed(1) + '" fill="' + color + '">' + level[0] + " " + (level[1] * 100).toFixed(1) + "%</text>");
      });
    });
    var terminals = {};
    var svgParts = (readout.simulated || []).map(function (s) {
      var stepX = plotW / (s.predictedCTR.length - 1);
      var pts = s.predictedCTR.map(function (val, i) { return (i * stepX).toFixed(1) + "," + toY(val).toFixed(1); }).join(" ");
      var last = s.predictedCTR[s.predictedCTR.length - 1];
      terminals[s.variantId] = { left: (plotW / vbW) * 100, top: (toY(last) / vbH) * 100 };
      return '<polyline class="curve-path" data-vid="' + esc(s.variantId) + '" points="' + pts + '" stroke="' + (ANGLE_COLOR[s.angleType] || "#1a1a1a") + '"/>';
    }).join("");
    var raceCard = el("article", "evidence-card tier1 race-card");
    raceCard.innerHTML = '<div class="evidence-eyebrow">the race &middot; predicted CTR' + (planDays ? " over " + planDays + " days" : "") + '</div>' +
      '<div class="race-plot"><svg viewBox="0 0 ' + vbW + " " + vbH + '">' + thresholdParts.join("") + svgParts + "</svg></div>";
    addCard(raceCard, "simulated + decided, from readout.json");
    var plot = raceCard.querySelector(".race-plot");
    (readout.decided || []).forEach(function (d) {
      var term = terminals[d.variantId];
      if (term) {
        var stamp = el("div", "curve-stamp " + d.verdict.toLowerCase(), esc(d.verdict));
        stamp.style.left = term.left.toFixed(2) + "%";
        stamp.style.top = term.top.toFixed(2) + "%";
        plot.appendChild(stamp);
        requestAnimationFrame(function () { stamp.classList.add("in"); });
      }
      var path = raceCard.querySelector('.curve-path[data-vid="' + d.variantId + '"]');
      if (path && d.verdict === "KILL") path.style.opacity = "0.28";
      if (path && d.verdict === "SCALE") path.style.strokeWidth = "4";
      if (d.verdict === "SCALE") {
        var variant = (readout.variants || []).find(function (v) { return v.id === d.variantId; });
        var verdict = el("div", "race-verdict");
        verdict.innerHTML = '<span class="race-bignum">' + (d.finalCTR * 100).toFixed(2) + '%</span><span class="race-bignum-note"><b>' +
          esc(variant ? variant.workingTitle : d.variantId) + '</b> scaled. Last-3-day CTR cleared the preregistered scale line.</span>';
        raceCard.appendChild(verdict);
      }
      if (!liveLogMode) inferredLog(d.variantId + " " + d.verdict + ": " + d.reason);
    });
  }

  function assetBasename(assetPath) {
    return assetPath ? String(assetPath).split("/").pop() : "";
  }

  function renderHero(readout) {
    showStage("cut");
    var scaleDecision = (readout.decided || []).find(function (d) { return d.verdict === "SCALE"; });
    if (scaleDecision) {
      var variant = (readout.variants || []).find(function (v) { return v.id === scaleDecision.variantId; });
      var named = (readout.namedAssets || []).find(function (n) { return n.variantId === scaleDecision.variantId && n.format === "still"; });
      var produced = (readout.produced || []).find(function (p) { return p.variantId === scaleDecision.variantId && p.format === "still"; });
      var stillName = named ? named.name : produced ? produced.name : "";
      addChapter("Act IV", "The winning still becomes the cut and holds the whole frame.");
      if (!liveLogMode) inferredLog("winner enters rollout: " + scaleDecision.variantId + " (" + (variant ? variant.workingTitle : "") + ")");
      var c = el("article", "evidence-card tier1 hero-card");
      c.innerHTML = '<div class="evidence-eyebrow">the winner &middot; the cut, held as a still</div>' +
        '<div class="hero-media">' + (stillName ? '<img src="assets/' + esc(stillName) + '.png" alt="' + esc(variant ? variant.workingTitle : stillName) + '" />' : "") + '</div>' +
        '<div class="hero-caption"><div class="evidence-title">' + esc(variant ? variant.workingTitle : stillName) + '</div>' +
        '<p class="evidence-caption">' + esc(produced ? produced.copy : "") + '</p></div>';
      addCard(c, "the SCALE winner from decided[], shown from its produced still");
    } else {
      addChapter("Act IV", "No still cleared the preregistered threshold, so the cut stays empty.");
      var empty = el("article", "evidence-card tier1");
      empty.innerHTML = '<div class="evidence-eyebrow">the cut</div><p class="evidence-caption">no still cleared the preregistered threshold this wave.</p>';
      addCard(empty, "decided[], no verdict === SCALE");
    }
  }

  function renderRolloutSection(readout) {
    showStage("rollout");
    if (rolloutLiveCard) {
      rolloutLiveCard.querySelectorAll("video").forEach(function (video) { video.pause(); });
      rolloutLiveCard.remove();
      rolloutLiveCard = null;
      rolloutCells = [];
      activeRolloutCellId = null;
    }
    (readout.rollouts || []).forEach(function (draft, draftIndex) {
      var variant = (readout.variants || []).find(function (v) { return v.id === draft.variantId; });
      var card = el("article", "evidence-card");
      card.innerHTML = '<div class="evidence-eyebrow">the channel cuts &middot; ' + esc(variant ? variant.workingTitle : draft.name) + '</div><div class="rollout-shelf"></div>';
      addCard(card, "rollout draft for " + (variant ? variant.workingTitle : draft.name));
      var shelf = card.querySelector(".rollout-shelf");
      (draft.channels || []).forEach(function (ch, channelIndex) {
        if (!liveLogMode) inferredLog("channel cut landing: " + ch.channel + " (" + ch.kpi + ")");
        var isVideo = ch.nativeFormat === "video";
        var assetSrc = ch.assetPath ? "assets/rollout/" + assetBasename(ch.assetPath) : null;
        var coverSrc = ch.coverPath ? "assets/rollout/" + assetBasename(ch.coverPath) : (isVideo ? null : assetSrc);
        var mediaHTML = coverSrc
          ? '<div class="rollout-chip-media"><img src="' + esc(coverSrc) + '" alt="' + esc(ch.channel) + '" /></div>'
          : '<div class="rollout-chip-media"><span class="evidence-caption">no rendered asset</span></div>';
        var cta = ch.postKit && ch.postKit.ctaPolicy ? ch.postKit.ctaPolicy : null;
        var ctaTag = cta ? '<span class="cta-tag cta-' + esc(cta.level) + '">CTA ' + esc(cta.level) + '</span>' : "";
        var postDetails = ch.postKit
          ? '<div class="rollout-details">' + esc(ch.postKit.caption || "") + '<br>' + esc(ch.postKit.postingNote || "") + '</div>'
          : "";
        var cell = el("div", "rollout-cell");
        var cellId = "rollout-" + draftIndex + "-" + channelIndex;
        cell.id = cellId;
        cell.innerHTML = mediaHTML + '<div class="rollout-meta"><div class="rollout-channel">' + esc(ch.channel) + '</div>' +
          '<div class="rollout-role">' + esc(ch.role || "") + '</div><p class="rollout-copy">&quot;' + esc(ch.channelCopy || "") + '&quot;</p>' +
          '<div class="rollout-kpi">' + esc(ch.kpi || "") + '</div>' + ctaTag + postDetails + '</div>';
        var note = ch.kpiThresholdNote || "";
        if (cta) note += " / cta: " + (cta.reason || "");
        if (ch.postKit) note += " / caption: " + (ch.postKit.caption || "") + " / posting: " + (ch.postKit.postingNote || "");
        cell.setAttribute("data-evidence", "1");
        cell.dataset.evidenceNote = note;
        shelf.appendChild(cell);
        bindRolloutCell({
          id: cellId,
          assetKey: ch.assetName || cellId,
          cell: cell,
          media: cell.querySelector(".rollout-chip-media"),
          coverSrc: coverSrc,
          videoRelSrc: isVideo ? assetSrc : null
        });
      });
      if (draft.participationKit) {
        var pk = draft.participationKit;
        var note = el("div", "participation-note");
        note.innerHTML = '<div class="rollout-role">participation kit</div><p class="evidence-caption">' + esc(pk.mechanic || "") + '</p>' +
          '<div class="rollout-details">creator shots: ' + esc((pk.creatorShotList || []).join(" / ")) + '<br>seed captions: ' +
          esc((pk.seedCaptions || []).join(" / ")) + '<br>credit: ' + esc(pk.creditRule || "") + '</div>';
        card.appendChild(note);
      }
    });
  }

  function renderBill(readout) {
    addChapter("Act V", "The completed wave adds up every asset it made and every decision it took.");
    var stillsCount = (readout.produced || []).filter(function (p) { return p.format === "still" && p.assetPath; }).length;
    var renderedVideos = [];
    (readout.rollouts || []).forEach(function (draft) {
      (draft.channels || []).forEach(function (ch) {
        if (ch.nativeFormat === "video" && ch.assetPath) renderedVideos.push(ch);
      });
    });
    var winnersCount = (readout.decided || []).filter(function (d) { return d.verdict === "SCALE"; }).length;
    var videoSeconds = Math.round(renderedVideos.reduce(function (sum, ch) { return sum + (Number(ch.videoDurationSec) || 0); }, 0));
    var items = [
      { to: 1, label: "seed in" },
      { to: (readout.variants || []).length, label: "bets placed" },
      { to: (readout.namedAssets || []).length, label: "assets named" },
      { to: stillsCount, label: "stills made" },
      { to: renderedVideos.length, label: "videos rendered" },
      { to: winnersCount, label: "scaled to rollout" },
      { to: videoSeconds, label: "seconds of finished video" }
    ];
    var c = el("article", "evidence-card tier1 bill-card");
    c.innerHTML = '<div class="evidence-eyebrow">the bill</div><p class="bill-lead">Everything the machine produced from one seed.</p>' +
      '<div class="bill-grid">' + items.map(function (item, i) {
        return '<div class="bill-item"><div class="bill-num" id="liveBill' + i + '">0</div><div class="bill-label">' + esc(item.label) + '</div></div>';
      }).join("") + '</div>';
    addCard(c, "every figure counted from readout.json");
    items.forEach(function (item, i) { countUp(document.getElementById("liveBill" + i), item.to, 900 + i * 120); });
  }

  async function pollReadout() {
    if (readoutLoaded) return;
    var readout = await getJSON("readout.json");
    if (!readout) return;
    readoutLoaded = true;
    if (!liveLogMode) inferredLog("readout.json written: wave " + WAVE_LABEL + " assembled");
    renderJudgeAndRace(readout);
    renderHero(readout);
    renderRolloutSection(readout);
    renderBill(readout);
    showStage("rollout");
    if (!liveLogMode) inferredLog("station 9 / learn: library.jsonl updated");
    document.body.setAttribute("data-done", "1");
    awaitingState.hidden = true;
    clearInterval(pollTimer);
  }

  logLine("$ growth-machine wave " + WAVE_LABEL, true);
  showStage("open");

  async function poll() {
    await pollLiveLog();
    await pollBriefs();
    await pollVariants();
    await pollNamedAssets();
    await pollPlan();
    await pollAssets();
    await pollRollout();
    await pollReadout();
  }
  poll();
  var pollTimer = setInterval(poll, POLL_MS);

  var lightbox = document.getElementById("lightbox");
  var lightboxMedia = document.getElementById("lightboxMedia");
  var lightboxNote = document.getElementById("lightboxNote");
  function openLightbox(target) {
    lightboxMedia.innerHTML = "";
    var clone = target.cloneNode(true);
    clone.removeAttribute("data-evidence");
    clone.querySelectorAll("video").forEach(function (video) { video.removeAttribute("autoplay"); });
    lightboxMedia.appendChild(clone);
    lightboxNote.textContent = target.dataset.evidenceNote || "";
    lightbox.hidden = false;
  }
  function closeLightbox() {
    lightbox.hidden = true;
    lightboxMedia.querySelectorAll("video").forEach(function (video) { video.pause(); });
    lightboxMedia.innerHTML = "";
  }
  document.addEventListener("click", function (event) {
    if (!lightbox.hidden) {
      if (event.target === lightbox) closeLightbox();
      return;
    }
    var target = event.target.closest("[data-evidence]");
    if (target) openLightbox(target);
  });
  document.addEventListener("keydown", function (event) {
    if ((event.code === "Space" || event.code === "Escape") && !lightbox.hidden) {
      event.preventDefault();
      closeLightbox();
    }
  });
})();
`;
