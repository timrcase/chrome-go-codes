const MANAGE_PAGE = "manage.html";

// Meta keys are reserved by leading "_". User codes cannot start with "_".
function isMetaKey(key) {
  return key.startsWith("_");
}

// Split omnibox text into the code and its argument string.
// "gh/anthropic/claude" -> { code: "gh", args: "anthropic/claude" }
function parseInput(text) {
  const slash = text.indexOf("/");
  if (slash === -1) return { code: text.trim().toLowerCase(), args: "" };
  return {
    code: text.slice(0, slash).trim().toLowerCase(),
    args: text.slice(slash + 1).trim(),
  };
}

// Substitute args into a URL template.
// {1},{2},...  -> positional segments of args (split on "/")
// Placeholders are optional: an unfilled {n} drops out along with a leading
// slash, so "github.com/{1}/{2}" works for "gh", "gh/a", and "gh/a/b".
// no placeholder + args -> args appended as a path
function applyTemplate(template, args) {
  const segments = args ? args.split("/") : [];
  const encodePath = (s) => s.split("/").map(encodeURIComponent).join("/");

  if (/\{\d+\}/.test(template)) {
    const url = template.replace(/\/?\{(\d+)\}/g, (match, key) => {
      const value = segments[Number(key) - 1];
      if (value === undefined || value === "") return "";
      const slash = match[0] === "/" ? "/" : "";
      return slash + encodeURIComponent(value);
    });
    // Tidy any separator left dangling once trailing slots are dropped.
    return url.replace(/[?&#]+$/, "").replace(/\/+$/, "");
  }

  if (args) {
    return template.replace(/\/+$/, "") + "/" + encodePath(args);
  }
  return template;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.omnibox.setDefaultSuggestion({
    description: "Type a short code, e.g. <match>gh</match>",
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL(MANAGE_PAGE) });
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const { code, args } = parseInput(text.trim());
  if (!code || isMetaKey(code)) return;

  const stored = await chrome.storage.sync.get(code);
  const template = stored[code];
  if (!template) {
    const manageUrl = chrome.runtime.getURL(
      `${MANAGE_PAGE}?invalid=true&code=${encodeURIComponent(code)}`,
    );
    await chrome.tabs.create({ url: manageUrl, active: true });
    return;
  }

  const url = applyTemplate(template, args);

  switch (disposition) {
    case "newForegroundTab":
      await chrome.tabs.create({ url, active: true });
      break;
    case "newBackgroundTab":
      await chrome.tabs.create({ url, active: false });
      break;
    case "currentTab":
    default:
      await chrome.tabs.update(undefined, { url });
      break;
  }
});
