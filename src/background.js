const MANAGE_PAGE = "manage.html";

// Meta keys are reserved by leading "_". User codes cannot start with "_".
function isMetaKey(key) {
  return key.startsWith("_");
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
  const code = text.trim().toLowerCase();
  if (!code || isMetaKey(code)) return;

  const stored = await chrome.storage.sync.get(code);
  const url = stored[code];
  if (!url) {
    console.log(`[go-codes] no mapping for "${code}"`);
    return;
  }

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
