// SyncPen Clipper - Background Service Worker

const API_BASE_URL = "https://www.syncpen.io";
const DEV_API_BASE_URL = "http://localhost:3000";

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    // Save selection menu item
    chrome.contextMenus.create({
      id: "saveSelection",
      title: "Save Selection to SyncPen",
      contexts: ["selection"],
    });

    // Save image menu item
    chrome.contextMenus.create({
      id: "saveImage",
      title: "Save Image to SyncPen",
      contexts: ["image"],
    });

    // Save page menu item
    chrome.contextMenus.create({
      id: "savePage",
      title: "Save Page to SyncPen",
      contexts: ["page"],
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.warn("SyncPen Clipper: API key not configured");
      showNotification("Error", "Please configure your API key in the extension settings.");
      return;
    }

    let clipData;

    switch (info.menuItemId) {
      case "saveSelection":
        clipData = await captureSelection(tab, info.selectionText);
        break;
      case "saveImage":
        clipData = await captureImage(tab, info.srcUrl);
        break;
      case "savePage":
        clipData = await capturePage(tab);
        break;
      default:
        return;
    }

    console.log("SyncPen Clipper: Sending clip to API...", { type: clipData.type });
    const response = await sendClipToSyncPen(clipData, apiKey);
    console.log("SyncPen Clipper: Clip saved successfully", response);
    const clipCount = response.clipCount ?? 0;
    showNotification("Success", `Clip saved! ${clipCount} clip${clipCount !== 1 ? "s" : ""} in Inbox`);
  } catch (error) {
    console.error("SyncPen Clipper error:", error);
    showNotification("Error", error.message || "Failed to save clip.");
  }
});

// Get API key from storage
async function getApiKey() {
  const result = await chrome.storage.sync.get(["apiKey"]);
  return result.apiKey || null;
}

// Get API base URL from storage (for dev mode)
async function getApiBaseUrl() {
  const result = await chrome.storage.sync.get(["devMode"]);
  return result.devMode ? DEV_API_BASE_URL : API_BASE_URL;
}

// Capture selected text
async function captureSelection(tab, selectionText) {
  // Get additional metadata from content script
  let result;
  try {
    [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        url: window.location.href,
        favicon: document.querySelector('link[rel*="icon"]')?.href || "",
        description: document.querySelector('meta[name="description"]')?.content || "",
      }),
    });
  } catch (err) {
    console.error("Script injection failed:", err);
    throw new Error("Cannot access this page. Try a different page.");
  }

  return {
    type: "text",
    content: selectionText,
    sourceUrl: result.result.url,
    sourceTitle: result.result.title,
    timestamp: new Date().toISOString(),
    metadata: {
      favicon: result.result.favicon,
      description: result.result.description,
    },
  };
}

// Capture image
async function captureImage(tab, imageUrl) {
  let result;
  try {
    [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        url: window.location.href,
        favicon: document.querySelector('link[rel*="icon"]')?.href || "",
      }),
    });
  } catch (err) {
    console.error("Script injection failed:", err);
    throw new Error("Cannot access this page. Try a different page.");
  }

  return {
    type: "image",
    content: imageUrl,
    sourceUrl: result.result.url,
    sourceTitle: result.result.title,
    timestamp: new Date().toISOString(),
    metadata: {
      favicon: result.result.favicon,
    },
  };
}

// Capture page
async function capturePage(tab) {
  let result;
  try {
    [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try to get the main content of the page
        const getTextContent = () => {
          // Try common content selectors
          const selectors = [
            "article",
            "main",
            '[role="main"]',
            ".post-content",
            ".article-content",
            ".entry-content",
            "#content",
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              return element.innerText.slice(0, 2000);
            }
          }

          // Fallback to body text
          return document.body.innerText.slice(0, 2000);
        };

        return {
          title: document.title,
          url: window.location.href,
          favicon: document.querySelector('link[rel*="icon"]')?.href || "",
          description: document.querySelector('meta[name="description"]')?.content || "",
          content: getTextContent(),
        };
      },
    });
  } catch (err) {
    console.error("Script injection failed:", err);
    throw new Error("Cannot access this page. Try a different page.");
  }

  return {
    type: "page",
    content: result.result.content,
    sourceUrl: result.result.url,
    sourceTitle: result.result.title,
    timestamp: new Date().toISOString(),
    metadata: {
      favicon: result.result.favicon,
      description: result.result.description,
    },
  };
}

// Send clip to SyncPen API
async function sendClipToSyncPen(clipData, apiKey) {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/clipper/clip`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(clipData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}

// Show notification
function showNotification(title, message) {
  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: `SyncPen Clipper - ${title}`,
      message: message,
    },
    (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error("Notification error:", chrome.runtime.lastError);
      }
    }
  );
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "testConnection") {
    testConnection(request.apiKey)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Test API connection
async function testConnection(apiKey) {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/clipper/clip`, {
    method: "OPTIONS",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // For OPTIONS, we just check if we can reach the endpoint
  // The actual validation happens on POST
  return { success: true };
}
