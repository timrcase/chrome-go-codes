const MAX_CODES = 500;

// Meta keys reserved by leading "_". Codes cannot start with "_".
function isMetaKey(key) {
  return key.startsWith("_");
}

const codeInput = document.getElementById("code-input");
const urlInput = document.getElementById("url-input");
const form = document.getElementById("add-form");
const submitBtn = form.querySelector('button[type="submit"]');
const tbody = document.getElementById("codes-body");
const emptyMsg = document.getElementById("empty");
const errorMsg = document.getElementById("error");
const counterEl = document.querySelector(".counter");
const counterText = document.getElementById("counter-text");
const counterFill = document.getElementById("counter-fill");
const noticeEl = document.getElementById("notice");

const isChromeStorage = typeof chrome !== "undefined" && chrome.storage?.sync;

function handleInvalidCode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("invalid") !== "true") return;

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
    return u.toString();
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
  const pct = Math.min(100, (count / MAX_CODES) * 100);
  counterText.textContent = `${count} / ${MAX_CODES} codes`;
  counterFill.style.width = `${pct}%`;
  counterEl.classList.remove("warn", "danger");
  if (count >= MAX_CODES) counterEl.classList.add("danger");
  else if (count >= MAX_CODES * 0.9) counterEl.classList.add("danger");
  else if (count >= MAX_CODES * 0.8) counterEl.classList.add("warn");

  const atLimit = count >= MAX_CODES;
  submitBtn.disabled = atLimit;
  submitBtn.title = atLimit ? `Limit of ${MAX_CODES} codes reached` : "";
}

function render(codes) {
  tbody.innerHTML = "";
  const entries = Object.entries(codes).sort(([a], [b]) => a.localeCompare(b));
  updateCounter(entries.length);

  if (entries.length === 0) {
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  for (const [code, url] of entries) {
    const tr = document.createElement("tr");

    const codeTd = document.createElement("td");
    codeTd.className = "code-cell";
    codeTd.textContent = code;

    const urlTd = document.createElement("td");
    urlTd.className = "url-cell";
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = url;
    urlTd.appendChild(a);

    const actionsTd = document.createElement("td");
    actionsTd.className = "actions";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "danger icon-btn";
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
    tbody.appendChild(tr);
  }
}

async function refresh() {
  const codes = await loadCodes();
  render(codes);
}

async function addCode(code, url) {
  if (!isChromeStorage) {
    showError("chrome.storage unavailable (not running as extension).");
    return;
  }
  await chrome.storage.sync.set({ [code]: url });
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

  await addCode(code, url);
  noticeEl.hidden = true;
  codeInput.value = "";
  urlInput.value = "";
  codeInput.focus();
});

if (isChromeStorage) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") refresh();
  });
}

refresh();
handleInvalidCode();
