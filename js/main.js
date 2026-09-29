// ============================================================
// MAIN.JS
// Renders data/*.js into the DOM and drives the site's
// interaction: background field, custom cursor, nav, reveals.
// You should not need to edit this file to update content —
// edit the files in /data instead.
//
// Built so that ONE mistake in ONE data entry can never take the
// rest of the site down with it:
//   - every data file is loaded on its own, fresh (never from a
//     stale browser cache), and a broken file only empties its own
//     section
//   - every section — and every single entry inside it — renders in
//     isolation, so a bad entry is skipped, not fatal
//   - image / PDF / link paths are cleaned up automatically
//   - problems are listed on-screen when you preview locally (or
//     add ?debug to the URL) and in the browser console anywhere
// ============================================================

/* ------------------------------------------------------------
   PROBLEM REPORTING
   On localhost, or with ?debug in the URL, problems are listed
   in a small panel in the corner. On the live site visitors
   never see it — the console still gets every message.
------------------------------------------------------------ */
const isDebug =
  ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname) ||
  /[?&]debug(=|&|$)/.test(location.search);

const problems = [];

function report(message, detail) {
  if (problems.includes(message)) return;
  problems.push(message);
  console.error(`[portfolio] ${message}`, detail ?? "");
  if (isDebug) renderProblemPanel();
}

function renderProblemPanel() {
  let panel = document.getElementById("data-problems");
  if (!panel) {
    if (!document.body) return;
    panel = document.createElement("aside");
    panel.id = "data-problems";
    panel.setAttribute("role", "status");
    document.body.appendChild(panel);
  }
  panel.innerHTML = `
    <div class="dp-head">
      <strong>${problems.length} problem${problems.length === 1 ? "" : "s"} found in your content</strong>
      <button type="button" class="dp-close" aria-label="Hide this panel">×</button>
    </div>
    <ul>${problems.map((m) => `<li>${escText(m)}</li>`).join("")}</ul>
    <p class="dp-foot">Only you see this (local preview / ?debug). Visitors don't.</p>`;
  panel.querySelector(".dp-close").addEventListener("click", () => panel.remove());
}

/* ------------------------------------------------------------
   TEXT + PATH HELPERS
------------------------------------------------------------ */
function escText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/* Turns whatever was typed into a path the browser can actually
   fetch: fixes Windows backslashes, a leading "/" or "./", and
   characters that break URLs (spaces, "#", "?", "%", non-English
   letters). Full web addresses pass through untouched. */
function assetUrl(path) {
  let p = String(path ?? "").trim();
  if (!p) return "";
  if (/^(https?:|data:|blob:)/i.test(p) || p.startsWith("//")) return p;
  if (/^[a-zA-Z]:[\\/]/.test(p) || /^file:/i.test(p)) {
    report(
      `"${path}" points to a file on your computer. Copy the file into the assets/ folder and use a path like "assets/images/name.jpg".`
    );
    return "";
  }
  p = p.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  return p
    .split("/")
    .map((seg) => {
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join("/");
}

/* Links to other websites (project "link"/"repo"). A missing
   "https://" is added instead of crashing the page. A certificate
   can be either a local PDF or a web link, so it uses this too. */
function linkUrl(value, { external = false } = {}) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (/^(https?:|mailto:|tel:|#)/i.test(s) || s.startsWith("//")) return s;
  if (/^www\./i.test(s) || /^([a-z0-9-]+\.)+[a-z]{2,}(\/|$)/i.test(s) && (external || s.includes("/"))) {
    return "https://" + s;
  }
  if (external) return "https://" + s.replace(/^\/+/, "");
  return assetUrl(s);
}

function hostOf(url, fallback) {
  try {
    return new URL(url, location.href).hostname || fallback;
  } catch {
    return fallback;
  }
}

/* Tolerant readers for hand-edited data. */
const asArray = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]);
const asList = (v, label) => {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    report(`${label} must be a list written as [ ... ] — it was ignored.`);
    return [];
  }
  return v.filter((item, i) => {
    const ok = item && typeof item === "object";
    if (!ok) report(`${label}: entry #${i + 1} isn't a { ... } block — it was skipped.`);
    return ok;
  });
};

/* Runs one piece of rendering; if it throws, report it and carry on
   so everything after it still gets built. */
function safe(label, fn) {
  try {
    return fn();
  } catch (err) {
    report(`${label} hit an error and was skipped: ${err && err.message ? err.message : err}`, err);
  }
}

/* ------------------------------------------------------------
   DATA LOADING
   Each file is imported separately with a unique ?v= stamp so the
   browser (and GitHub Pages' cache) can never serve an old copy of
   a file you just edited. A file with a typo empties only its own
   section; the rest of the site loads normally.
------------------------------------------------------------ */
let profile = {
  name: "",
  field: "",
  university: "",
  status: "",
  tagline: "",
  about: "",
  email: "",
  heroMeta: [],
  cv: "assets/cv.pdf",
  social: [],
};
let research = [];
let projects = [];
let skills = [];
let coursework = [];
let labTech = [];
let education = [];
let competitions = [];
let achievements = [];

const DATA_STAMP = Date.now();

async function loadDataFile(name) {
  const url = new URL(`../data/${name}.js`, import.meta.url);
  url.searchParams.set("v", DATA_STAMP);
  try {
    return await import(url.href);
  } catch (err) {
    report(
      `data/${name}.js could not be read, so that section is empty. Usually a typo in the file you last edited: a missing comma between { } blocks, a missing or extra quote, or an unclosed bracket. (${err && err.message ? err.message : err})`,
      err
    );
    return {};
  }
}

async function loadData() {
  const [p, r, pr, sk, cw, ed, co, ac] = await Promise.all(
    ["profile", "research", "projects", "skills", "coursework", "education", "competitions", "achievements"].map(
      loadDataFile
    )
  );
  if (p.profile && typeof p.profile === "object") profile = { ...profile, ...p.profile };
  profile.social = asList(profile.social, "profile.social");
  profile.heroMeta = asArray(profile.heroMeta);

  research = asList(r.research, "research.js");
  projects = asList(pr.projects, "projects.js");
  skills = asList(sk.skills, "skills.js");
  coursework = asList(cw.coursework, "coursework.js (coursework)");
  labTech = asList(cw.labTech, "coursework.js (labTech)");
  education = asList(ed.education, "education.js");
  competitions = asList(co.competitions, "competitions.js");
  achievements = asList(ac.achievements, "achievements.js");
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isFinePointer = window.matchMedia("(pointer: fine)").matches;

/* ------------------------------------------------------------
   RENDER: HERO
------------------------------------------------------------ */
function renderHero() {
  document.getElementById("hero-eyebrow").textContent = profile.university || "";
  // hero-name content is set by initHeroNameAnimation(), which
  // splits it into letters for the entrance animation
  document.getElementById("hero-field").textContent = [profile.field, profile.status]
    .filter(Boolean)
    .join(" — ");
  document.getElementById("hero-tagline").textContent = profile.tagline || "";

  const cv = document.getElementById("hero-cv");
  cv.href = assetUrl(profile.cv) || "assets/cv.pdf";

  const gh = document.getElementById("hero-github");
  const githubLink = profile.social.find((s) => s.label === "GitHub");
  if (githubLink && githubLink.url) {
    gh.href = linkUrl(githubLink.url, { external: true });
  } else {
    gh.hidden = true;
  }

  const meta = document.getElementById("hero-meta");
  const metaLines = profile.heroMeta.map((line) => String(line ?? "").trim()).filter(Boolean);
  if (meta && metaLines.length) {
    meta.replaceChildren(
      ...metaLines.map((line) => {
        const span = document.createElement("span");
        span.className = "hero-meta-line";
        span.textContent = line;
        return span;
      })
    );
  } else if (meta) {
    meta.hidden = true;
  }

  document.getElementById("footer-name").textContent = `${profile.name} — ${new Date().getFullYear()}`;
}

/* ------------------------------------------------------------
   RENDER: ABOUT
   Headline (L2) states the field; the side column carries the
   supporting sentence (L3) and factual meta (L4).
------------------------------------------------------------ */
function renderAbout() {
  document.getElementById("about-headline").textContent = profile.field || "";
  document.getElementById("about-text").textContent = profile.about || "";
  document.getElementById("about-meta").textContent = [profile.university, profile.status]
    .filter(Boolean)
    .join(" — ");
}

/* ------------------------------------------------------------
   RENDER: RESEARCH
   Each entry gets a large index numeral so two works never read
   as one undifferentiated block of text.
------------------------------------------------------------ */
/* ------------------------------------------------------------
   SHARED: entry media block (photo slot used on Research,
   Competitions and Projects). Renders a real <img> if a path is
   given, otherwise an abstract placeholder panel — see
   css/style.css .entry-media for the visual treatment.
------------------------------------------------------------ */
function buildEntryMedia(imagePath, altText) {
  const src = assetUrl(imagePath);
  const inner = src
    ? `<img src="${escText(src)}" alt="${escText(altText)}" loading="lazy" data-asset="${escText(imagePath)}" />`
    : `<div class="entry-media-placeholder" aria-hidden="true"></div>`;
  return `<div class="entry-media">${inner}</div>`;
}

/* If a photo can't be loaded (wrong name, wrong capitals, file not
   uploaded yet) swap in the normal placeholder instead of a broken-
   image icon, and say which path failed. The "error" event doesn't
   bubble, so this listens in the capture phase. */
function initImageFallbacks() {
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.asset) return;
      report(
        `Image not found: "${img.dataset.asset}". Check the spelling, the extension (.jpg vs .jpeg) and capital letters (the live site is case-sensitive), and that the file is inside assets/images/.`
      );
      const ph = document.createElement("div");
      ph.className = img.classList.contains("project-visual-image")
        ? "project-visual-body"
        : "entry-media-placeholder";
      ph.setAttribute("aria-hidden", "true");
      img.replaceWith(ph);
    },
    true
  );
}

function doiUrl(doi) {
  const d = String(doi ?? "").trim();
  if (!d) return "";
  if (/^https?:\/\//i.test(d)) return d;
  return "https://doi.org/" + d.replace(/^doi:\s*/i, "");
}

function renderResearch() {
  const list = document.getElementById("research-list");

  research.forEach((item, i) =>
    safe(`Research entry #${i + 1}`, () => {
      const repoLink = linkUrl(item.repo, { external: true });
      const doiLink = doiUrl(item.doi);

      const links = [
        repoLink ? `<a class="research-link" href="${escText(repoLink)}" target="_blank" rel="noopener">Repo ↗</a>` : "",
        doiLink ? `<a class="research-link" href="${escText(doiLink)}" target="_blank" rel="noopener">DOI ↗</a>` : "",
      ]
        .filter(Boolean)
        .join("");

      const row = document.createElement("div");
      row.className = "research-item reveal";
      row.innerHTML = `
      <div class="research-item-main">
        <span class="research-index">${String(i + 1).padStart(2, "0")}</span>
        <div class="research-content">
          ${item.year ? `<p class="research-year">${escText(item.year)}</p>` : ""}
          <h3 class="research-title">${escText(item.title)}</h3>
          ${item.authors ? `<p class="research-authors">${escText(item.authors)}</p>` : ""}
          ${item.note ? `<p class="research-note">${escText(item.note)}</p>` : ""}
          ${links ? `<div class="research-links">${links}</div>` : ""}
        </div>
      </div>
      ${item.status ? `<span class="tag">${escText(item.status)}</span>` : ""}
    `;
      list.appendChild(row);
    })
  );
}

/* ------------------------------------------------------------
   RENDER: PROJECTS
------------------------------------------------------------ */
function renderProjects() {
  if (projects.length === 0) return;

  const [featured, ...rest] = projects;
  const featureEl = document.getElementById("projects-feature");

  safe("The featured project (the FIRST one in projects.js)", () => {
    const link = linkUrl(featured.link, { external: true });
    const repo = linkUrl(featured.repo, { external: true });
    const tools = asArray(featured.tools).join(" · ");
    const imageSrc = assetUrl(featured.image);

    featureEl.innerHTML = `
    <div class="project-feature reveal">
      <div class="project-feature-text">
        ${featured.year ? `<p class="project-year">${escText(featured.year)}</p>` : ""}
        <h3 class="project-title">${escText(featured.title)}</h3>
        <p class="project-desc">${escText(featured.description)}</p>
        ${tools ? `<p class="project-tools">${escText(tools)}</p>` : ""}
        <div class="project-links">
          ${link ? `<a class="project-link" href="${escText(link)}" target="_blank" rel="noopener">View live ↗</a>` : ""}
          ${repo ? `<a class="project-link" href="${escText(repo)}" target="_blank" rel="noopener">Source</a>` : ""}
        </div>
      </div>
      <div class="project-visual">
        <div class="project-visual-chrome">
          <span class="project-visual-dot"></span>
          <span class="project-visual-dot"></span>
          <span class="project-visual-dot"></span>
          <span class="project-visual-url">${escText(link ? hostOf(link, "live project") : "live project")}</span>
        </div>
        ${
          imageSrc
            ? `<img class="project-visual-image" src="${escText(imageSrc)}" alt="${escText(featured.title)}" loading="lazy" data-asset="${escText(featured.image)}" />`
            : `<div class="project-visual-body" aria-hidden="true"></div>`
        }
      </div>
    </div>
  `;
  });

  const moreEl = document.getElementById("projects-more");
  const viewAllBtn = document.getElementById("projects-view-all");
  const visibleRest = rest.slice(0, 4);
  const hiddenRest = rest.slice(4);

  const addRow = (p, n, extraClass) =>
    safe(`Project #${n}`, () => {
      const row = buildProjectRow(p);
      if (extraClass) row.classList.add(extraClass);
      moreEl.appendChild(row);
    });

  visibleRest.forEach((p, i) => addRow(p, i + 2));

  if (hiddenRest.length > 0) {
    // Rendered now (so the content exists in the page for crawlers)
    // but kept out of layout via .is-overflow until "View all" is
    // clicked — same visible behavior as before, just pre-rendered.
    hiddenRest.forEach((p, i) => addRow(p, i + 6, "is-overflow"));
    viewAllBtn.textContent = `View all (${hiddenRest.length} more)`;
    viewAllBtn.hidden = false;
    viewAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      moreEl.querySelectorAll(".project-row.is-overflow").forEach((el) => el.classList.remove("is-overflow"));
      viewAllBtn.hidden = true;
      observeReveals();
    });
  }
}

function buildProjectRow(p) {
  const link = linkUrl(p.link, { external: true });
  const row = document.createElement("div");
  row.className = "project-row reveal";
  row.innerHTML = `
    <div class="project-row-content">
      ${p.year ? `<p class="project-year">${escText(p.year)}</p>` : ""}
      <h4 class="research-title" style="font-size: 1.05rem;">${escText(p.title)}</h4>
      <p class="research-note">${escText(p.description)}</p>
      ${link ? `<a class="project-link" href="${escText(link)}" target="_blank" rel="noopener" style="margin-top: 0.6em; display: inline-flex;">View ↗</a>` : ""}
    </div>
    ${buildEntryMedia(p.image, p.title)}
  `;
  return row;
}

/* ------------------------------------------------------------
   SHARED: text escaping + category glyphs
   Data files are authored by hand, so a stray "&" or "<" in a
   course title shouldn't be able to mangle the markup.
------------------------------------------------------------ */
const esc = escText;

/* Line-art glyphs drawn from the domain itself (an op-amp, a chip,
   a lens) rather than generic UI icons, so a category is
   recognisable before its name is read. Every path inherits
   currentColor, so hover/tier color changes carry to the glyph
   with no extra rules. */
const GLYPHS = {
  code: '<path d="M9 6.2 3.6 12 9 17.8"/><path d="m15 6.2 5.4 5.8-5.4 5.8"/>',
  opamp: '<path d="M8.4 4.8v14.4L19.6 12 8.4 4.8Z"/><path d="M2 8.4h6.4M2 15.6h6.4"/>',
  wave: '<path d="M2 12c2.5 0 2.5-6.6 5-6.6S9.5 18.6 12 18.6s2.5-6.6 5-6.6 2.5 3.3 5 3.3"/>',
  network:
    '<circle cx="6" cy="6.8" r="2.6"/><circle cx="6" cy="17.2" r="2.6"/><circle cx="17.6" cy="12" r="2.8"/><path d="m8.4 8 6.8 2.8M8.4 16l6.8-2.8"/>',
  chip: '<rect x="6.6" y="6.6" width="10.8" height="10.8" rx="1.6"/><path d="M9.8 6.6V3M14.2 6.6V3M9.8 17.4V21M14.2 17.4V21M6.6 9.8H3M6.6 14.2H3M17.4 9.8H21M17.4 14.2H21"/>',
  lens: '<path d="M12 3c3.2 3.2 3.2 14.8 0 18-3.2-3.2-3.2-14.8 0-18Z"/><path d="M1.8 12h5.4M16.8 12h5.4M2.6 6.6h3.2M18.2 6.6h3.2M2.6 17.4h3.2M18.2 17.4h3.2"/>',
  scope:
    '<rect x="2.2" y="4.6" width="19.6" height="14.8" rx="2.2"/><path d="M5.8 12.6c1.7 0 1.7-4.2 3.4-4.2s1.7 7.4 3.4 7.4 1.7-4.2 3.4-4.2 1.4 2 2.2 2"/>',
  terminal:
    '<rect x="2.2" y="4.6" width="19.6" height="14.8" rx="2.2"/><path d="m6.8 9.6 3.4 2.9-3.4 2.9"/><path d="M12.6 15.4h4.8"/>',
  board:
    '<rect x="3" y="3" width="18" height="18" rx="2.2"/><circle cx="8.4" cy="8.4" r="1.7"/><path d="M8.4 11.4v3.2a1.8 1.8 0 0 0 1.8 1.8h5.4"/><path d="M12.2 8.4h4.6"/>',
  index:
    '<path d="M4.2 4.4h9.6a3 3 0 0 1 3 3v12.2H7.2a3 3 0 0 1-3-3V4.4Z"/><path d="M16.8 19.6h3"/><path d="M8.2 9h5.2M8.2 13h3.2"/>',
  motor:
    '<circle cx="10.4" cy="12" r="7"/><circle cx="10.4" cy="12" r="2.4"/><path d="M17.4 12h4.2"/><path d="M5.4 19.4h10"/>',
  node: '<path d="m12 2.8 9.2 9.2-9.2 9.2L2.8 12 12 2.8Z"/><path d="M12 8.2 15.8 12 12 15.8 8.2 12 12 8.2Z"/>',
};

/* Longest/most specific phrases first — "engineering tools" has to
   win over the generic "tool" entry further down the list. */
const GLYPH_KEYWORDS = [
  [["engineering tool", "eda", "cad", "simulation", "simulator"], "opamp"],
  [["program", "language", "coding", "code"], "code"],
  [["signal", "dsp", "communication", "acoustic"], "wave"],
  [["intelligence", "machine learning", "deep learning", "ai", "vision", "data"], "network"],
  [["electronic", "embedded", "microcontroller", "microprocessor", "processor", "circuit", "power", "logic"], "chip"],
  [["machine", "motor", "drive", "dynamometer", "generator", "transformer"], "motor"],
  [["photonic", "optic", "electromagnet", "laser", "rf", "microwave", "antenna"], "lens"],
  [["instrument", "measurement", "equipment", "bench", "test", "meter"], "scope"],
  [["hardware", "board", "component", "device", "module", "kit"], "board"],
  [["software", "tool", "toolchain", "platform", "language"], "terminal"],
];

function glyphFor(name) {
  const key = String(name || "").toLowerCase();
  const match = GLYPH_KEYWORDS.find(([words]) => words.some((w) => key.includes(w)));
  return GLYPHS[match ? match[1] : "node"];
}

function glyphMarkup(name, explicitKey) {
  const paths = explicitKey ? GLYPHS[explicitKey] : glyphFor(name);
  return `<span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
    stroke-linejoin="round">${paths}</svg></span>`;
}

/* Pointer-tracked highlight: the card's own hover treatment stays
   in CSS; this only feeds it the cursor position. Skipped entirely
   on touch devices and when reduced motion is requested. */
function attachPointerGlow(cards) {
  if (!isFinePointer || reducedMotion) return;
  cards.forEach((card) => {
    card.addEventListener(
      "pointermove",
      (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      },
      { passive: true }
    );
  });
}

/* ------------------------------------------------------------
   RENDER: SKILLS
   Each category is a module in a rack: domain glyph, category
   name, a rule that carries the eye across to the item count,
   then the items as chips. The three variants from data/skills.js
   still drive real differences in composition — arrow and flow
   are half-width cards, ledger is a full-width strip — so the
   grid never reads as one component repeated six times.
------------------------------------------------------------ */
function renderSkills() {
  const container = document.getElementById("skills-composition");
  const cards = [];

  skills.forEach((group, gi) => safe(`Skills group #${gi + 1}`, () => {
    const items = asArray(group.items);
    const el = document.createElement("article");
    el.className = `skill-card skill-card--${group.variant || "flow"} reveal`;
    el.dataset.weight = group.weight || "secondary";

    const chips = items
      .map(
        (item, i) =>
          `<li class="skill-chip" style="--chip-i:${i}"><span>${esc(item)}</span></li>`
      )
      .join("");

    el.innerHTML = `
      <div class="skill-card-head">
        ${glyphMarkup(group.group)}
        <h3 class="skill-cat">${esc(group.group)}</h3>
        <span class="skill-rule" aria-hidden="true"></span>
        <span class="skill-count" aria-hidden="true">${String(items.length).padStart(2, "0")}</span>
      </div>
      <ul class="skill-items">${chips}</ul>
    `;
    container.appendChild(el);
    cards.push(el);
  }));

  attachPointerGlow(cards);
}

/* ------------------------------------------------------------
   RENDER: COURSEWORK & LAB
   Two deliberately different readings of the same tier of
   evidence: coursework is a ruled academic index (codes in a
   fixed column, titles running past them), lab work is clustered
   chips. Cyan carries the left side, violet the right, so the
   split is legible at a glance without a second card style.

   Like Achievements, the whole section — and its nav link —
   only exists once data/coursework.js has something in it. If
   only one of the two arrays is filled, that side takes the
   full width instead of leaving a hole.
------------------------------------------------------------ */
function renderCoursework() {
  const courseList = Array.isArray(coursework) ? coursework.filter((c) => c && c.title) : [];
  const labList = Array.isArray(labTech)
    ? labTech
        .map((c) => (c ? { ...c, items: asArray(c.items) } : c))
        .filter((c) => c && c.category && c.items.length > 0)
    : [];

  if (courseList.length === 0 && labList.length === 0) {
    document.getElementById("nav-coursework-item")?.remove();
    return;
  }

  document.getElementById("coursework").hidden = false;
  const split = document.getElementById("coursework-split");
  if (courseList.length === 0 || labList.length === 0) {
    split.classList.add("cl-split--single");
  }

  if (courseList.length > 0) {
    // If not a single course carries a code, a fixed code column
    // would just be decorative numbering, so the list drops it and
    // uses the same small node marker the Skills chips use.
    const anyCode = courseList.some((c) => c.code);
    const rows = courseList
      .map((c, i) => {
        const marker = anyCode
          ? `<span class="cl-code">${c.code ? esc(c.code) : String(i + 1).padStart(2, "0")}</span>`
          : `<span class="cl-marker" aria-hidden="true"></span>`;
        return `
          <li class="cl-course">
            ${marker}
            <span class="cl-course-body">
              <span class="cl-course-name">${esc(c.title)}</span>
              ${c.note ? `<span class="cl-course-note">${esc(c.note)}</span>` : ""}
            </span>
          </li>`;
      })
      .join("");

    const side = document.createElement("div");
    side.className = "cl-side cl-side--courses reveal";
    side.innerHTML = `
      <div class="cl-head">
        ${glyphMarkup("", "index")}
        <h3 class="cl-title">Selected Coursework</h3>
        <span class="cl-rule" aria-hidden="true"></span>
        <span class="cl-count" aria-hidden="true">${String(courseList.length).padStart(2, "0")}</span>
      </div>
      <ul class="cl-courses${anyCode ? "" : " cl-courses--plain"}">${rows}</ul>
    `;
    split.appendChild(side);
  }

  if (labList.length > 0) {
    const total = labList.reduce((sum, c) => sum + c.items.length, 0);
    const clusters = labList
      .map((cluster) => {
        const chips = cluster.items
          .map(
            (item, i) => `<li class="lab-chip" style="--chip-i:${i}"><span>${esc(item)}</span></li>`
          )
          .join("");
        return `
          <div class="cl-cluster">
            <div class="cl-cluster-head">
              ${glyphMarkup(cluster.category)}
              <h4 class="cl-cluster-name">${esc(cluster.category)}</h4>
            </div>
            <ul class="cl-chips">${chips}</ul>
          </div>`;
      })
      .join("");

    const side = document.createElement("div");
    side.className = "cl-side cl-side--lab reveal";
    side.innerHTML = `
      <div class="cl-head">
        ${glyphMarkup("", "scope")}
        <h3 class="cl-title">Lab &amp; Technology</h3>
        <span class="cl-rule" aria-hidden="true"></span>
        <span class="cl-count" aria-hidden="true">${String(total).padStart(2, "0")}</span>
      </div>
      <div class="cl-clusters">${clusters}</div>
    `;
    split.appendChild(side);
  }

  attachPointerGlow(Array.from(split.querySelectorAll(".cl-cluster")));
}

/* ------------------------------------------------------------
   RENDER: EDUCATION
------------------------------------------------------------ */
function renderEducation() {
  const list = document.getElementById("education-list");
  education.forEach((item, i) =>
    safe(`Education entry #${i + 1}`, () => {
      const el = document.createElement("div");
      el.className = "education-item reveal";
      el.innerHTML = `
      <div class="education-level">${escText(item.level)}</div>
      <div class="education-name">${escText(item.institution)}</div>
      ${item.detail ? `<div class="education-detail">${escText(item.detail)}</div>` : ""}
      ${item.result ? `<div class="education-result">${escText(item.result)}</div>` : ""}
    `;
      list.appendChild(el);
    })
  );
}

/* ------------------------------------------------------------
   RENDER: COMPETITIONS
   Same numbered-row pattern as Research — one continuous,
   divided list rather than a separate card component.
------------------------------------------------------------ */
function renderCompetitions() {
  const list = document.getElementById("competitions-list");

  competitions.forEach((item, i) =>
    safe(`Competition #${i + 1}`, () => {
      const metaParts = [item.role, item.organizer].filter(Boolean).join(" · ");
      const cert = linkUrl(item.certificate);
      const titleInner = cert
        ? `<a href="${escText(cert)}" target="_blank" rel="noopener">${escText(item.name)}<span class="title-link-arrow">↗</span></a>`
        : escText(item.name);
      const row = document.createElement("div");
      row.className = "competition-item reveal";
      row.innerHTML = `
      <div class="competition-item-main">
        <span class="competition-index">${String(i + 1).padStart(2, "0")}</span>
        <div class="competition-content">
          <h3 class="competition-title">${titleInner}</h3>
          ${metaParts ? `<p class="competition-meta">${escText(metaParts)}</p>` : ""}
        </div>
      </div>
      ${buildEntryMedia(item.image, item.name)}
      ${item.year ? `<span class="competition-year">${escText(item.year)}</span>` : ""}
    `;
      list.appendChild(row);
    })
  );
}

/* ------------------------------------------------------------
   RENDER: ACHIEVEMENTS (section only exists if data is present)
------------------------------------------------------------ */
function renderAchievements() {
  if (!achievements || achievements.length === 0) {
    document.getElementById("nav-achievements-item")?.remove();
    return;
  }

  const section = document.getElementById("achievements");
  section.hidden = false;

  const list = document.getElementById("achievements-list");
  const viewAllBtn = document.getElementById("achievements-view-all");
  const visible = achievements.slice(0, 5);
  const hidden = achievements.slice(5);

  const addRow = (a, n, extraClass) =>
    safe(`Achievement #${n}`, () => {
      const row = buildAchievementRow(a);
      if (extraClass) row.classList.add(extraClass);
      list.appendChild(row);
    });

  visible.forEach((a, i) => addRow(a, i + 1));

  if (hidden.length > 0) {
    // Rendered now (so the content exists in the page for crawlers)
    // but kept out of layout via .is-overflow until "View all" is
    // clicked — same visible behavior as before, just pre-rendered.
    hidden.forEach((a, i) => addRow(a, i + 6, "is-overflow"));
    viewAllBtn.textContent = `View all (${hidden.length} more)`;
    viewAllBtn.hidden = false;
    viewAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      list.querySelectorAll(".achievement-item.is-overflow").forEach((el) => el.classList.remove("is-overflow"));
      viewAllBtn.hidden = true;
      observeReveals();
    });
  }
}

function buildAchievementRow(a) {
  const el = document.createElement("div");
  el.className = "achievement-item reveal";
  const cert = linkUrl(a.certificate);
  const titleInner = cert
    ? `<a href="${escText(cert)}" target="_blank" rel="noopener">${escText(a.title)}<span class="title-link-arrow">↗</span></a>`
    : escText(a.title);
  el.innerHTML = `
    <h3 class="achievement-title">${titleInner}</h3>
    ${a.note ? `<div class="achievement-note">${escText(a.note)}</div>` : ""}
  `;
  return el;
}

/* ------------------------------------------------------------
   RENDER: CONTACT
   Social links render as real brand icons (via the Simple Icons
   embed service — MIT licensed for exactly this use) inside
   understated circular buttons, with a text fallback if an icon
   fails to load (e.g. offline, or a platform without an icon).
------------------------------------------------------------ */
function renderContact() {
  const emailEl = document.getElementById("contact-email");
  emailEl.textContent = profile.email || "";
  emailEl.href = profile.email ? `mailto:${profile.email}` : "#";

  const socialsEl = document.getElementById("contact-socials");
  profile.social.forEach((s, i) =>
    safe(`Social link #${i + 1}`, () => {
      const label = String(s.label ?? "");
      const a = document.createElement("a");
      a.className = "social-icon";
      a.href = linkUrl(s.url, { external: true }) || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", label);

      if (s.icon) {
        const img = document.createElement("img");
        img.src = `https://cdn.simpleicons.org/${encodeURIComponent(s.icon)}/a7b0bd`;
        img.alt = "";
        img.loading = "lazy";
        img.addEventListener("error", () => a.classList.add("icon-failed"));
        a.appendChild(img);
      } else {
        a.classList.add("icon-failed");
      }

      const fallback = document.createElement("span");
      fallback.className = "social-icon-fallback";
      fallback.textContent = label.slice(0, 2).toUpperCase();
      a.appendChild(fallback);

      socialsEl.appendChild(a);
    })
  );
}

/* ------------------------------------------------------------
   STRUCTURED DATA (SEO)
   A Person JSON-LD block, built from the same profile data as the
   rest of the page, so it can never drift out of sync with what a
   visitor actually sees. Replaces itself if called more than once.
   The static WebSite block in index.html's <head> covers the parts
   that don't depend on data/*.js.
------------------------------------------------------------ */
const SITE_URL = "https://mahmudul28.io/";

function injectStructuredData() {
  const sameAs = profile.social
    .map((s) => linkUrl(s.url, { external: true }))
    .filter(Boolean);

  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name || undefined,
    url: SITE_URL,
    jobTitle: profile.field || undefined,
    description: profile.tagline || profile.about || undefined,
    email: profile.email ? `mailto:${profile.email}` : undefined,
    alumniOf: profile.university ? { "@type": "CollegeOrUniversity", name: profile.university } : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };

  Object.keys(person).forEach((key) => {
    if (person[key] === undefined) delete person[key];
  });

  if (!person.name) return; // nothing reliable enough to publish yet

  document.getElementById("ld-person")?.remove();
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "ld-person";
  // Guard against a stray "</script>" inside any field breaking the page.
  script.textContent = JSON.stringify(person).replace(/</g, "\\u003c");
  document.head.appendChild(script);
}

/* ------------------------------------------------------------
   SECTION LABELS
   Numbers every section kicker ("01 — About", "02 — Research", …)
   based on which sections actually appear, so hiding Achievements
   doesn't leave a gap in the sequence.
------------------------------------------------------------ */
function assignSectionLabels() {
  const labels = Array.from(document.querySelectorAll(".section-label[data-label]")).filter(
    (el) => !el.closest("section")?.hidden
  );
  labels.forEach((el, i) => {
    el.textContent = `${String(i + 1).padStart(2, "0")} — ${el.dataset.label}`;
  });
}

/* ------------------------------------------------------------
   NAV: scroll state, active link, mobile toggle
------------------------------------------------------------ */
function initNav() {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  // Clone the desktop link list into the mobile full-screen overlay so
  // there's one source of truth (see the HTML comment on #mobile-nav
  // for why this lives as a separate, non-nested element).
  const desktopList = document.getElementById("nav-links");
  const mobileList = desktopList.cloneNode(true);
  mobileList.removeAttribute("id");
  mobileList.classList.remove("nav-links");
  mobileNav.appendChild(mobileList);

  const allLinks = () => document.querySelectorAll(".nav-links a, .mobile-nav a");

  window.addEventListener(
    "scroll",
    () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 40);
    },
    { passive: true }
  );

  toggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  allLinks().forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  const sections = Array.from(document.querySelectorAll("section[id]")).filter((s) => !s.hidden);
  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            allLinks().forEach((l) => l.classList.remove("is-active"));
            document
              .querySelectorAll(`.nav-links a[href="#${entry.target.id}"], .mobile-nav a[href="#${entry.target.id}"]`)
              .forEach((l) => l.classList.add("is-active"));
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => spy.observe(s));
  }
}

/* ------------------------------------------------------------
   REVEAL ON SCROLL
------------------------------------------------------------ */
let revealObserver;
function observeReveals() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
  }
  document.querySelectorAll(".reveal:not(.is-visible)").forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 6, 5) * 40}ms`;
    revealObserver.observe(el);
  });
}

/* ------------------------------------------------------------
   SIGNAL TRACES — the portfolio's one recurring graphical motif:
   a small oscilloscope-style pulse (flat baseline, one or two
   short risers) built as a real <svg><path>, in actual pixel
   units, rather than a stretched background-image. Two call
   sites share this geometry so it reads as a single system:
     - under each section title (bigger, draws on with the title)
     - riding the hairline seam between sections (smaller, always
       gently moving — see .seam-trace / seam-flow in style.css)
   buildPulsePath() takes fixed-size notches (constant regardless
   of the surrounding width) and only stretches the flat connecting
   segments, which are straight lines and so don't distort.
------------------------------------------------------------ */
function buildPulsePath(width, height, notches) {
  const y = height / 2;
  const rise = height * 0.32;
  let d = `M0,${y}`;
  let cursor = 0;
  notches.forEach((atFraction, i) => {
    const notchW = i === 0 ? 24 : 18;
    const x = Math.max(cursor + 20, Math.min(width - notchW - 20, width * atFraction));
    d += ` L${x.toFixed(1)},${y}`;
    d += ` L${(x + notchW * 0.3).toFixed(1)},${(y - rise).toFixed(1)}`;
    d += ` L${(x + notchW * 0.7).toFixed(1)},${(y - rise).toFixed(1)}`;
    d += ` L${(x + notchW).toFixed(1)},${y}`;
    cursor = x + notchW;
  });
  d += ` L${width},${y}`;
  return d;
}

function createTraceSvg(className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "var(--cyan)");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.appendChild(path);
  return { svg, path };
}

/* Under section titles — draws on (stroke-dashoffset) in sync with
   .title-animate, triggered from initTitleAnimations() below. */
function initSignalTraces() {
  const titles = document.querySelectorAll(".section-title");
  const registry = new Map();

  function build(el) {
    const rect = el.getBoundingClientRect();
    const overflow = window.innerWidth * 0.06; // matches CSS left: -6vw
    const width = Math.max(120, Math.round(rect.width + overflow * 2));
    const height = 15;

    let entry = registry.get(el);
    if (!entry) {
      entry = createTraceSvg("signal-trace");
      entry.path.setAttribute("stroke-width", "1.4");
      el.prepend(entry.svg);
      registry.set(el, entry);
    }
    const { svg, path } = entry;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    path.setAttribute("d", buildPulsePath(width, height, [0.28, 0.64]));

    const len = path.getTotalLength();
    path.style.transition = "none";
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = el.classList.contains("title-animate") ? "0" : `${len}`;
    void path.getBoundingClientRect(); // flush before re-enabling transition
    path.style.transition = "";
    entry.length = len;
  }

  titles.forEach(build);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => titles.forEach(build), 200);
  });

  return registry;
}

/* Riding the seam between sections — built once per seam; the
   gentle continuous motion is pure CSS (seam-flow), not redrawn
   per scroll, so it stays cheap. */
function initSeamTraces() {
  const seams = document.querySelectorAll("section:not(:first-of-type)");

  function build(el) {
    const rect = el.getBoundingClientRect();
    const width = Math.max(160, Math.round(rect.width * 0.76)); // matches CSS left/right: 12%
    const height = 10;

    let path = el.querySelector(":scope > svg.seam-trace > path");
    if (!path) {
      const entry = createTraceSvg("seam-trace");
      entry.path.setAttribute("stroke-width", "1");
      el.prepend(entry.svg);
      path = entry.path;
    }
    const svg = path.closest("svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    path.setAttribute("d", buildPulsePath(width, height, [0.5]));
  }

  seams.forEach(build);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => seams.forEach(build), 200);
  });
}

/* ------------------------------------------------------------
   SECTION TITLE ANIMATION — line + shimmer, replayed every time
   the title scrolls back into view (not just once). Separate
   from observeReveals(), which only fires once per element.
------------------------------------------------------------ */
function initTitleAnimations() {
  const titles = document.querySelectorAll(".section-title");
  const traces = initSignalTraces();

  if (!("IntersectionObserver" in window) || reducedMotion) {
    titles.forEach((t) => {
      t.classList.add("title-animate");
      const trace = traces.get(t);
      if (trace) trace.path.style.strokeDashoffset = "0";
    });
    return;
  }
  const currentlyVisible = new WeakSet();
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (entry.isIntersecting && !currentlyVisible.has(el)) {
          currentlyVisible.add(el);
          el.classList.remove("title-animate", "title-shimmer");
          void el.offsetWidth; // force reflow so the animation restarts
          el.classList.add("title-animate", "title-shimmer");
          setTimeout(() => el.classList.remove("title-shimmer"), 1900);

          const trace = traces.get(el);
          if (trace) {
            trace.path.style.transition = "none";
            trace.path.style.strokeDashoffset = `${trace.length}`;
            void trace.path.getBoundingClientRect();
            trace.path.style.transition = "";
            trace.path.style.strokeDashoffset = "0";
          }
        } else if (!entry.isIntersecting) {
          currentlyVisible.delete(el);
        }
      });
    },
    { threshold: 0.5 }
  );
  titles.forEach((t) => obs.observe(t));
}

/* ------------------------------------------------------------
   HERO NAME ANIMATION — on page load, each word of the name
   rises smoothly out of an invisible line, one after the other,
   while a soft blur clears. Plays once. The name's look at rest
   is untouched: when the entrance ends, every animation
   property is removed. See .hero-name-* in style.css.
------------------------------------------------------------ */
function initHeroNameAnimation() {
  const nameEl = document.getElementById("hero-name");
  const words = String(profile.name || "").split(" ").filter(Boolean);
  if (words.length === 0) return;

  // each word is its own no-wrap unit so a line break can only
  // happen BETWEEN words, never in the middle of one. The inner
  // span is the part that moves; --i sets the stagger order.
  nameEl.innerHTML = words
    .map(
      (word, i) =>
        `<span class="hero-name-word"><span class="hero-name-inner" style="--i:${i}">${escText(word)}</span></span>`
    )
    .join(" ");

  // reduced-motion visitors simply get the finished name
  if (reducedMotion) {
    nameEl.classList.add("name-done");
    return;
  }

  // once the last word has landed, strip the animation entirely
  const lastInner = nameEl.lastElementChild.firstElementChild;
  lastInner.addEventListener("animationend", (e) => {
    if (e.animationName !== "name-rise") return;
    nameEl.classList.remove("name-animate");
    nameEl.classList.add("name-done");
  });

  const play = () => {
    // two frames so the hidden starting state is painted first
    requestAnimationFrame(() => requestAnimationFrame(() => nameEl.classList.add("name-animate")));
  };

  // wait (briefly) for the heading font so the name doesn't
  // shift or change shape mid-animation; never wait long
  const fontReady =
    document.fonts && document.fonts.load
      ? document.fonts.load('600 1em "Space Grotesk"').catch(() => {})
      : Promise.resolve();
  const patience = new Promise((resolve) => setTimeout(resolve, 1200));
  Promise.race([fontReady, patience]).then(play);
}

/* ------------------------------------------------------------
   CUSTOM CURSOR
------------------------------------------------------------ */
function initCursor() {
  if (!isFinePointer) {
    document.body.classList.add("no-fine-cursor");
    return;
  }

  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });

  function loop() {
    ringX += (mouseX - ringX) * 0.16;
    ringY += (mouseY - ringY) * 0.16;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  const magnets = document.querySelectorAll("a, button");
  magnets.forEach((el) => {
    el.addEventListener("mouseenter", () => ring.classList.add("is-magnetic"));
    el.addEventListener("mouseleave", () => ring.classList.remove("is-magnetic"));
  });
}

/* ------------------------------------------------------------
   BACKGROUND: flow-field canvas
   Lightweight value-noise flow field. No external dependency.
------------------------------------------------------------ */
function initField() {
  const canvas = document.getElementById("field-canvas");
  const ctx = canvas.getContext("2d");
  let width, height, dpr;
  let pointer = { x: 0, y: 0, active: false };
  let raf = null;

  // cheap 2D value noise
  const gridSize = 48;
  let noiseGrid = [];
  function seedNoise() {
    noiseGrid = [];
    const cols = Math.ceil(window.innerWidth / gridSize) + 2;
    const rows = Math.ceil(window.innerHeight / gridSize) + 2;
    for (let x = 0; x < cols; x++) {
      noiseGrid[x] = [];
      for (let y = 0; y < rows; y++) {
        noiseGrid[x][y] = Math.random() * Math.PI * 2;
      }
    }
  }

  function angleAt(x, y, t) {
    const gx = Math.floor(x / gridSize);
    const gy = Math.floor(y / gridSize);
    const base = (noiseGrid[gx] && noiseGrid[gx][gy]) || 0;
    let angle = base + Math.sin(t * 0.06 + gx * 0.3) * 0.6 + Math.cos(t * 0.05 + gy * 0.3) * 0.6;

    if (pointer.active) {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const influence = Math.max(0, 1 - dist / 260);
      if (influence > 0) {
        const pointerAngle = Math.atan2(dy, dx) + Math.PI / 2;
        angle = angle * (1 - influence) + pointerAngle * influence;
      }
    }
    return angle;
  }

  let particles = [];
  function seedParticles() {
    const count = window.innerWidth < 720 ? 46 : 110;
    particles = new Array(count).fill(null).map(() => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      life: Math.random() * 200,
      hue: Math.random() > 0.5 ? "cyan" : "violet",
    }));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedNoise();
    seedParticles();
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, width, height);
  }

  let t = 0;
  function step() {
    t += 1;
    ctx.fillStyle = "rgba(5, 7, 10, 0.065)";
    ctx.fillRect(0, 0, width, height);

    particles.forEach((p) => {
      const angle = angleAt(p.x, p.y, t);
      const speed = 0.6;
      const nx = p.x + Math.cos(angle) * speed;
      const ny = p.y + Math.sin(angle) * speed;

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = p.hue === "cyan" ? "rgba(82, 227, 255, 0.35)" : "rgba(167, 139, 250, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      p.x = nx;
      p.y = ny;
      p.life -= 1;

      if (p.life <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
        p.life = 120 + Math.random() * 160;
      }
    });

    raf = requestAnimationFrame(step);
  }

  function staticFrame() {
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(82, 227, 255, 0.12)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40, y + 10);
      ctx.stroke();
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener(
    "mousemove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    },
    { passive: true }
  );
  window.addEventListener("mouseleave", () => (pointer.active = false));

  resize();

  if (reducedMotion) {
    staticFrame();
  } else {
    step();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        step();
      }
    });
  }
}

/* ------------------------------------------------------------
   DEBUG-ONLY FILE CHECK
   On localhost / ?debug, confirm the CV and every certificate PDF
   you linked actually exists, and say so if not. (Photos are
   already checked as they load — see initImageFallbacks.)
------------------------------------------------------------ */
function checkLinkedFiles() {
  const targets = [
    ["CV", profile.cv],
    ...competitions.map((c) => [`Certificate for "${c.name}"`, c.certificate]),
    ...achievements.map((a) => [`Certificate for "${a.title}"`, a.certificate]),
  ];
  targets.forEach(([label, path]) => {
    const url = linkUrl(path);
    if (!url || /^(https?:|\/\/|mailto:|tel:|#)/i.test(url)) return;
    fetch(url, { method: "HEAD", cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          report(
            `${label}: file not found at "${path}". Check the spelling and capital letters, and that it is inside the assets/ folder.`
          );
        }
      })
      .catch(() => {});
  });
}

/* ------------------------------------------------------------
   INIT
   Every stage is isolated: if one fails it is reported and the
   rest still run, so a single problem can never blank the page.
------------------------------------------------------------ */
async function init() {
  initImageFallbacks();
  await loadData();

  safe("Hero", renderHero);
  safe("About", renderAbout);
  safe("Research", renderResearch);
  safe("Projects", renderProjects);
  safe("Skills", renderSkills);
  safe("Education", renderEducation);
  safe("Competitions", renderCompetitions);
  safe("Achievements", renderAchievements);
  safe("Coursework", renderCoursework);
  safe("Contact", renderContact);
  safe("Section numbering", assignSectionLabels);
  safe("Structured data", injectStructuredData);

  safe("Navigation", initNav);
  safe("Cursor", initCursor);
  safe("Background", initField);
  safe("Scroll reveals", observeReveals);
  safe("Title animations", initTitleAnimations);
  safe("Section traces", initSeamTraces);
  safe("Name animation", initHeroNameAnimation);

  if (isDebug) safe("File check", checkLinkedFiles);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
