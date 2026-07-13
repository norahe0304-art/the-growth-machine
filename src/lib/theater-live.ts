/**
 * [INPUT]: depends on theater.ts's exported THEATER_CSS (same visual system, no readout needed
 *   at generation time)
 * [OUTPUT]: exports renderTheaterLive(waveNumber) -> string, a self-contained live.html that
 *   polls its own wave directory over http and renders as files land
 * [POS]: the live twin of theater.ts. theater.ts replays a wave that has already finished, every
 *   artifact baked into the HTML at generation time; theater-live.ts is generated the moment a
 *   wave starts and carries no data of its own, it polls waves/wave-NN/ every 2s for
 *   brief-v{1,2,3}.json, plan.json, assets/ and assets/rollout/ (directory listings, so new
 *   files are discovered without knowing their names in advance), an optional live-log.jsonl
 *   for a hand-authored narrative (also carries the human approval gate as typed events,
 *   {type:"proposal", variants:[...]} shows the three concepts and the "awaiting operator
 *   approval" gate, {type:"decision", line:"..."} clears it), and finally readout.json, at
 *   which point it renders the remaining sections (judge/race/rollout) in one pass and stops
 *   polling. Requires an http server with directory listings (`python3 -m http.server` from
 *   the repo root); file:// can't fetch() and a directory-listing-less server can't be
 *   crawled for unpredictable filenames.
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
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
      </section>
    </div>

    <footer class="bottombar">
      <div class="bottombar-fill" id="progressFill"></div>
      <div class="bottombar-caption">live: watching wave ${escapeHTML(waveLabel)} as it runs</div>
    </footer>

    <div class="approval-gate" id="approvalGate">
      <div class="approval-gate-text">awaiting operator approval</div>
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
`;

// ============================================================
// JS: a 2s poll loop. No pre-baked data, no TIMELINE, no pause/lightbox --
// the wave itself is the pacing. Two independent concerns, deliberately
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

  var logStream = document.getElementById("logStream");
  var evidenceStack = document.getElementById("evidenceStack");

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

  var STAGE_KEYS = ["open", "insight", "naming", "plan", "produce", "judge", "race", "cut", "rollout"];
  function showStage(key) {
    var idx = STAGE_KEYS.indexOf(key);
    if (idx < 0) return;
    document.getElementById("progressFill").style.width = (((idx + 1) / STAGE_KEYS.length) * 100).toFixed(2) + "%";
    document.querySelectorAll("#topbarStations li").forEach(function (li) {
      var liIdx = STAGE_KEYS.indexOf(li.getAttribute("data-key"));
      li.classList.toggle("done", liIdx < idx);
      li.classList.toggle("active", liIdx === idx);
    });
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
  var seenRollout = {};
  var liveLogMode = false;
  var liveLogLinesSeen = 0;
  var readoutLoaded = false;
  var planLoaded = false;

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
    (entry.variants || []).forEach(function (v, i) {
      var c = el("article", "evidence-card");
      c.innerHTML = '<div class="evidence-eyebrow">PROPOSAL ' + String(i + 1).padStart(2, "0") + '</div>' +
        '<div class="evidence-title">' + esc(v.workingTitle || "") + '</div>' +
        '<div class="variant-row"><b>' + esc(v.asset || "") + '</b> x <b>' + esc(v.newElement || "") + '</b></div>' +
        '<p class="evidence-caption">' + esc(v.angle || "") + '</p>' +
        '<span class="angle-badge">' + esc(v.angleType || "") + '</span>';
      addCard(c, "proposal event, live-log.jsonl");
    });
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
    var c = el("article", "evidence-card");
    c.innerHTML = '<div class="evidence-eyebrow">the brief</div>' +
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
      if (!liveLogMode) {
        inferredLog("brief-v" + i + ".json written: " + (brief.assetXElement || brief.workingTitle || "v" + i));
        if (brief.referenceSet && brief.referenceSet.source) {
          inferredLog("consulting " + brief.referenceSet.source + ", " + (brief.referenceSet.status || "") + ": " + (brief.referenceSet.note || ""));
        }
      }
      showStage("insight");
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
    var c = el("article", "evidence-card");
    c.innerHTML = '<div class="evidence-eyebrow">preregistered thresholds</div><table class="plan-table"><thead><tr><th>angle</th><th>scale at</th><th>kill at</th><th>fatigue</th></tr></thead><tbody>' + rows + "</tbody></table>";
    addCard(c, "plan.json, preRegisteredThresholds");
  }

  var economicsLogged = false;
  async function pollAssets() {
    var files = await listDir("assets/");
    var pngs = files.filter(function (f) { return f.toLowerCase().endsWith(".png"); });
    for (var i = 0; i < pngs.length; i++) {
      var name = pngs[i];
      if (seenAssets[name]) continue;
      seenAssets[name] = true;
      showStage("produce");
      if (!liveLogMode && !economicsLogged) {
        economicsLogged = true;
        inferredLog("economics: stills via codex exec, subscription, no per-token bill; video generation gated behind operator approval");
      }
      if (!liveLogMode) inferredLog("generating " + name.replace(/\\.png$/, "") + " via codex exec");
      var c = el("article", "evidence-card");
      c.innerHTML = '<div class="produce-media"><img src="assets/' + esc(name) + '" alt="' + esc(name) + '" /></div>' +
        '<div class="evidence-name" style="margin-top:8px;">' + esc(name) + '</div>';
      addCard(c, "assets/" + name + ", real generation call, discovered by directory listing");
    }
  }

  async function pollRollout() {
    var files = await listDir("assets/rollout/");
    var media = files.filter(function (f) { return /\\.(png|mp4)$/i.test(f); });
    for (var i = 0; i < media.length; i++) {
      var name = media[i];
      if (seenRollout[name]) continue;
      seenRollout[name] = true;
      showStage("rollout");
      var token = name.split("_")[0];
      var channel = channelTokenToName(token);
      var isVideo = /\\.mp4$/i.test(name);
      if (!liveLogMode) inferredLog(isVideo ? "video rendered: " + name : "channel cut landing: " + channel);
      var c = el("article", "evidence-card");
      var media_html = isVideo
        ? '<div class="rollout-chip-media"><video muted autoplay loop playsinline src="assets/rollout/' + esc(name) + '"></video></div>'
        : '<div class="rollout-chip-media"><img src="assets/rollout/' + esc(name) + '" alt="' + esc(name) + '" /></div>';
      c.innerHTML = media_html + '<div class="rollout-meta"><div class="rollout-channel">' + esc(channel) + '</div><div class="evidence-name">' + esc(name) + '</div></div>';
      addCard(c, "assets/rollout/" + name);
    }
  }

  function renderJudgeAndRace(readout) {
    showStage("judge");
    (readout.variants || []).forEach(function (v) {
      var judge = (readout.judged || []).find(function (j) { return j.variantId === v.id && j.format === "still"; });
      if (!judge) return;
      var c = el("article", "evidence-card");
      var dims = [["on brief", judge.score.onBrief], ["legible", judge.score.legible], ["shareable", judge.score.shareable]];
      if (judge.score.brandFit != null) dims.push(["brand fit", judge.score.brandFit]);
      c.innerHTML = '<div class="evidence-eyebrow">' + esc(v.workingTitle) + '</div>' +
        dims.map(function (d) { return '<div class="judge-dim"><span>' + d[0] + '</span><span>' + d[1] + ' / 3</span></div>'; }).join("") +
        '<span class="judge-pass' + (judge.passed ? "" : " fail") + '">' + (judge.passed ? "PASS" : "FAIL") + "</span>";
      addCard(c, judge.notes);
      if (!liveLogMode) inferredLog(v.id + " judge: " + dims.map(function (d) { return d[0] + " " + d[1]; }).join(", ") + " -> " + (judge.passed ? "PASS" : "FAIL"));
    });

    showStage("race");
    var w = 640, h = 220;
    var all = [];
    (readout.simulated || []).forEach(function (s) { all = all.concat(s.predictedCTR); });
    var max = Math.max.apply(null, all.concat([0.0001]));
    function toY(v) { return h - (v / max) * (h - 20) - 10; }
    var colors = { moment: "#c2410c", evergreen: "#2f6b6b", "ugc-loop": "#6b4fa0" };
    var svgParts = (readout.simulated || []).map(function (s) {
      var stepX = w / (s.predictedCTR.length - 1);
      var pts = s.predictedCTR.map(function (val, i) { return (i * stepX).toFixed(1) + "," + toY(val).toFixed(1); }).join(" ");
      return '<polyline class="curve-path" points="' + pts + '" stroke="' + (colors[s.angleType] || "#1a1a1a") + '" stroke-width="2.5" fill="none"/>';
    }).join("");
    var stamps = (readout.decided || []).map(function (d) {
      var v = (readout.variants || []).find(function (vv) { return vv.id === d.variantId; });
      return '<div class="race-stamp in ' + d.verdict.toLowerCase() + '">' + esc(d.verdict) + " " + esc(v ? v.workingTitle : d.variantId) + "</div>";
    }).join("");
    var reasons = (readout.decided || []).map(function (d) { return '<div class="race-reason">' + esc(d.reason) + "</div>"; }).join("");
    var raceCard = el("article", "evidence-card race-card");
    raceCard.innerHTML = '<div class="evidence-eyebrow">the race, predicted CTR</div><svg viewBox="0 0 ' + w + ' ' + h + '">' + svgParts + '</svg><div class="race-stamps">' + stamps + "</div>" + reasons;
    addCard(raceCard, "simulated + decided, from readout.json");
    (readout.decided || []).forEach(function (d) {
      if (!liveLogMode) inferredLog(d.variantId + " " + d.verdict + ": " + d.reason);
    });
  }

  function renderRolloutSection(readout) {
    showStage("cut");
    var scaleDecision = (readout.decided || []).find(function (d) { return d.verdict === "SCALE"; });
    if (scaleDecision) {
      var variant = (readout.variants || []).find(function (v) { return v.id === scaleDecision.variantId; });
      if (!liveLogMode) inferredLog("winner enters rollout: " + scaleDecision.variantId + " (" + (variant ? variant.workingTitle : "") + ")");
    }
    showStage("rollout");
    (readout.rollouts || []).forEach(function (draft) {
      (draft.channels || []).forEach(function (ch) {
        if (!liveLogMode) inferredLog("channel cut landing: " + ch.channel + " (" + ch.kpi + ")");
        if (ch.postKit) {
          var c = el("article", "evidence-card");
          var ctaTag = ch.postKit.ctaPolicy ? '<span class="cta-tag cta-' + esc(ch.postKit.ctaPolicy.level) + '">CTA ' + esc(ch.postKit.ctaPolicy.level) + '</span>' : "";
          c.innerHTML = '<div class="evidence-eyebrow">' + esc(ch.channel) + ' post kit</div>' +
            '<p class="evidence-caption">' + esc(ch.postKit.caption) + "</p>" +
            '<p class="evidence-caption">' + esc(ch.postKit.postingNote) + "</p>" + ctaTag;
          addCard(c, ch.postKit.ctaPolicy ? ch.kpiThresholdNote + " / cta: " + ch.postKit.ctaPolicy.reason : ch.kpiThresholdNote);
        }
      });
      if (draft.participationKit) {
        var pk = el("article", "evidence-card");
        pk.innerHTML = '<div class="evidence-eyebrow">participation kit</div><p class="evidence-caption">' + esc(draft.participationKit.mechanic) + "</p>";
        addCard(pk, draft.participationKit.creditRule);
      }
    });
  }

  async function pollReadout() {
    if (readoutLoaded) return;
    var readout = await getJSON("readout.json");
    if (!readout) return;
    readoutLoaded = true;
    if (!liveLogMode) inferredLog("readout.json written: wave " + WAVE_LABEL + " assembled");
    renderJudgeAndRace(readout);
    renderRolloutSection(readout);
    showStage("rollout");
    if (!liveLogMode) inferredLog("station 9 / learn: library.jsonl updated");
    document.body.setAttribute("data-done", "1");
    clearInterval(pollTimer);
  }

  logLine("$ growth-machine wave " + WAVE_LABEL, true);
  showStage("open");

  async function poll() {
    await pollLiveLog();
    await pollBriefs();
    await pollPlan();
    await pollAssets();
    await pollRollout();
    await pollReadout();
  }
  poll();
  var pollTimer = setInterval(poll, POLL_MS);
})();
`;
