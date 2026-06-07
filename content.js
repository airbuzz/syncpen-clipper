// SyncPen Clipper - Content Script

// Get selected text with basic formatting preserved
function getSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return "";
  }

  // Get the selection as text
  return selection.toString();
}

// Get selected HTML (for future rich text support)
function getSelectedHtml() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return "";
  }

  const range = selection.getRangeAt(0);
  const container = document.createElement("div");
  container.appendChild(range.cloneContents());
  return container.innerHTML;
}

// Get image URL from right-clicked element
function getSelectedImage() {
  // This is handled by the context menu info.srcUrl
  return null;
}

// Get page metadata
function getPageMetadata() {
  return {
    title: document.title,
    url: window.location.href,
    description:
      document.querySelector('meta[name="description"]')?.content || "",
    favicon:
      document.querySelector('link[rel*="icon"]')?.href ||
      document.querySelector('link[rel="shortcut icon"]')?.href ||
      `${window.location.origin}/favicon.ico`,
  };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "getSelectedText":
      sendResponse({ text: getSelectedText() });
      break;
    case "getSelectedHtml":
      sendResponse({ html: getSelectedHtml() });
      break;
    case "getPageMetadata":
      sendResponse(getPageMetadata());
      break;
    default:
      sendResponse({ error: "Unknown action" });
  }
  return true;
});
