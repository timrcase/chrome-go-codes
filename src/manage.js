const MAX_CODES = 500;
// Rows shown before the "View all N records" toggle expands the full list.
const PREVIEW_COUNT = 5;

// Meta keys reserved by leading "_". Codes cannot start with "_".
function isMetaKey(key) {
  return key.startsWith("_");
}

const codeInput = document.getElementById("code-input");
const urlInput = document.getElementById("url-input");
const form = document.getElementById("add-form");
const submitBtn = document.getElementById("add-btn");
const tbody = document.getElementById("codes-body");
const emptyMsg = document.getElementById("empty");
const errorMsg = document.getElementById("error");
const usageCard = document.querySelector(".usage-card");
const counterText = document.getElementById("counter-text");
const counterFill = document.getElementById("counter-fill");
const noticeEl = document.getElementById("notice");
const filterBtn = document.getElementById("filter-btn");
const searchBtn = document.getElementById("search-btn");
const searchWrap = document.getElementById("search-wrap");
const searchInput = document.getElementById("search-input");
const viewAllBtn = document.getElementById("view-all");

// Custom validation owns the messaging; skip the browser's native popups.
form.noValidate = true;

const isChromeStorage = typeof chrome !== "undefined" && chrome.storage?.sync;

// View state for the saved-codes list.
let currentCodes = {};
let sortDir = "asc"; // "asc" | "desc"
let searchQuery = "";
let expanded = false;

function handleInvalidCode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("invalid") !== "true") return false;

  const code = normalizeCode(params.get("code") || "");
  if (code) {
    codeInput.value = code;
    urlInput.focus();
    noticeEl.textContent = `"${code}" isn't assigned yet. Add a URL to create it.`;
  } else {
    codeInput.focus();
    noticeEl.textContent = "That code isn't assigned yet. Add it below.";
  }
  noticeEl.hidden = false;

  // Strip params so a refresh doesn't re-trigger the notice.
  history.replaceState(null, "", window.location.pathname);
  return true;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

function normalizeCode(raw) {
  return raw.trim().toLowerCase();
}

function normalizeUrl(raw) {
  let v = raw.trim();
  if (!v) return null;
  if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(v)) {
    v = "https://" + v;
  }
  try {
    const u = new URL(v);
    // Only http(s) — block javascript:, data:, file:, etc.
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Keep template placeholders ({1}, {*}) readable — URL() encodes braces.
    return u.toString().replace(/%7B/gi, "{").replace(/%7D/gi, "}");
  } catch {
    return null;
  }
}

async function loadCodes() {
  if (!isChromeStorage) return {};
  const all = await chrome.storage.sync.get(null);
  const codes = {};
  for (const [k, v] of Object.entries(all)) {
    if (isMetaKey(k)) continue;
    codes[k] = v;
  }
  return codes;
}

function updateCounter(count) {
  const pct = Math.min(1, count / MAX_CODES);
  counterText.textContent = `${count} / ${MAX_CODES}`;
  counterFill.value = pct;
  usageCard.classList.remove("warn", "danger");
  if (count >= MAX_CODES * 0.9) usageCard.classList.add("danger");
  else if (count >= MAX_CODES * 0.8) usageCard.classList.add("warn");

  const atLimit = count >= MAX_CODES;
  submitBtn.disabled = atLimit;
  submitBtn.title = atLimit ? `Limit of ${MAX_CODES} codes reached` : "";
}

// Build a URL anchor with {1}, {2}… placeholders highlighted.
function buildUrlLink(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  for (const part of url.split(/(\{\d+\})/)) {
    if (!part) continue;
    if (/^\{\d+\}$/.test(part)) {
      const v = document.createElement("span");
      v.className = "var";
      v.textContent = part;
      a.appendChild(v);
    } else {
      a.appendChild(document.createTextNode(part));
    }
  }
  return a;
}

function makeRow(code, url) {
  const tr = document.createElement("tr");

  const codeTd = document.createElement("td");
  codeTd.className = "code-cell";
  const codeChip = document.createElement("span");
  codeChip.className = "code-chip";
  codeChip.textContent = code;
  codeTd.appendChild(codeChip);

  const urlTd = document.createElement("td");
  urlTd.className = "url-cell";
  urlTd.appendChild(buildUrlLink(url));

  const actionsTd = document.createElement("td");
  actionsTd.className = "actions-cell";
  const delBtn = document.createElement("md-icon-button");
  delBtn.title = `Delete "${code}"`;
  delBtn.setAttribute("aria-label", `Delete ${code}`);
  delBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  `;
  delBtn.addEventListener("click", () => deleteCode(code));
  actionsTd.appendChild(delBtn);

  tr.appendChild(codeTd);
  tr.appendChild(urlTd);
  tr.appendChild(actionsTd);
  return tr;
}

function render() {
  const all = Object.entries(currentCodes);
  updateCounter(all.length);

  const q = searchQuery.trim().toLowerCase();
  let entries = all;
  if (q) {
    entries = entries.filter(
      ([code, url]) =>
        code.toLowerCase().includes(q) || url.toLowerCase().includes(q),
    );
  }
  entries.sort(([a], [b]) =>
    sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a),
  );

  tbody.innerHTML = "";

  if (entries.length === 0) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = q
      ? "No codes match your search."
      : "No codes yet. Add one above.";
    viewAllBtn.parentElement.hidden = true;
    viewAllBtn.hidden = true;
    return;
  }
  emptyMsg.hidden = true;

  // Only paginate the full, unfiltered list — searches show every match.
  const collapsed = !expanded && !q && entries.length > PREVIEW_COUNT;
  const shown = collapsed ? entries.slice(0, PREVIEW_COUNT) : entries;
  for (const [code, url] of shown) {
    tbody.appendChild(makeRow(code, url));
  }

  if (!q && entries.length > PREVIEW_COUNT) {
    viewAllBtn.parentElement.hidden = false;
    viewAllBtn.hidden = false;
    viewAllBtn.textContent = expanded
      ? "Show fewer"
      : `View all ${entries.length} records`;
  } else {
    viewAllBtn.parentElement.hidden = true;
    viewAllBtn.hidden = true;
  }
}

async function refresh() {
  currentCodes = await loadCodes();
  render();
}

async function addCode(code, url) {
  if (!isChromeStorage) {
    showError("chrome.storage unavailable (not running as extension).");
    return false;
  }
  try {
    await chrome.storage.sync.set({ [code]: url });
    return true;
  } catch (err) {
    // Per-item byte cap (long URL) or write rate limit.
    showError(`Couldn't save: ${err?.message || "storage error"}`);
    return false;
  }
}

async function deleteCode(code) {
  if (!isChromeStorage) return;
  await chrome.storage.sync.remove(code);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const code = normalizeCode(codeInput.value);
  if (!code) {
    showError("Code is required.");
    return;
  }
  if (/\s/.test(code)) {
    showError("Code cannot contain spaces.");
    return;
  }
  if (code.includes("/")) {
    showError("Code cannot contain a slash — it separates the code from variables.");
    return;
  }
  if (isMetaKey(code)) {
    showError("Code cannot start with an underscore.");
    return;
  }

  const url = normalizeUrl(urlInput.value);
  if (!url) {
    showError("URL is not valid.");
    return;
  }

  const existing = await loadCodes();
  const isUpdate = Object.prototype.hasOwnProperty.call(existing, code);
  if (!isUpdate && Object.keys(existing).length >= MAX_CODES) {
    showError(`Limit of ${MAX_CODES} codes reached. Delete one to add more.`);
    return;
  }

  if (!(await addCode(code, url))) return;
  noticeEl.hidden = true;
  codeInput.value = "";
  urlInput.value = "";
  codeInput.focus();
});

// Material text fields are custom elements, so the browser's "Enter submits
// the form" behavior doesn't fire automatically — trigger it ourselves.
for (const field of [codeInput, urlInput]) {
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}

// Toolbar: sort toggle.
filterBtn.addEventListener("click", () => {
  sortDir = sortDir === "asc" ? "desc" : "asc";
  filterBtn.classList.toggle("active", sortDir === "desc");
  filterBtn.title = sortDir === "asc" ? "Sort A→Z" : "Sort Z→A";
  render();
});

// Toolbar: search toggle + filtering.
const searchClear = document.getElementById("search-clear");

function closeSearch() {
  searchWrap.hidden = true;
  searchBtn.classList.remove("active");
  searchQuery = "";
  searchInput.value = "";
  render();
}

searchBtn.addEventListener("click", () => {
  if (searchWrap.hidden) {
    searchWrap.hidden = false;
    searchBtn.classList.add("active");
    searchInput.focus();
  } else {
    closeSearch();
  }
});

searchClear.addEventListener("click", closeSearch);

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  render();
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSearch();
});

viewAllBtn.addEventListener("click", () => {
  expanded = !expanded;
  render();
});

if (isChromeStorage) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") refresh();
  });
}

// How-it-works dialog. Meta key "_hiwDismissed" hides the auto-open on load.
const HIW_KEY = "_hiwDismissed";
const hiwModal = document.getElementById("hiw-modal");
const hiwBtn = document.getElementById("how-it-works");
const hiwGotIt = document.getElementById("hiw-got-it");
const hiwDontShow = document.getElementById("hiw-dont-show");

hiwBtn.addEventListener("click", () => hiwModal.show());

// The "Got it" button submits the dialog form (method="dialog"), which closes
// the dialog; persist the "don't show again" choice on the way out.
hiwGotIt.addEventListener("click", async () => {
  if (hiwDontShow.checked && isChromeStorage) {
    await chrome.storage.sync.set({ [HIW_KEY]: true });
  }
});

async function maybeAutoShow() {
  if (!isChromeStorage) return;
  const stored = await chrome.storage.sync.get(HIW_KEY);
  if (!stored[HIW_KEY]) hiwModal.show();
}

refresh();
// Don't auto-pop the modal over the invalid-code notice.
if (!handleInvalidCode()) maybeAutoShow();
