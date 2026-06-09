// SyncPen Clipper - Popup Script

document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("apiKey");
  const toggleVisibilityBtn = document.getElementById("toggleVisibility");
  const saveBtn = document.getElementById("saveBtn");
  const clearBtn = document.getElementById("clearBtn");
  const statusEl = document.getElementById("status");
  const messageEl = document.getElementById("message");

  // Load saved settings
  const settings = await chrome.storage.sync.get(["apiKey"]);
  if (settings.apiKey) {
    apiKeyInput.value = settings.apiKey;
    updateStatus(true);
  }

  // Toggle password visibility
  toggleVisibilityBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
    toggleVisibilityBtn.textContent = isPassword ? "🙈" : "👁️";
  });

  // Save API key
  saveBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showMessage("Please enter an API key", "error");
      return;
    }

    if (!apiKey.startsWith("sp_")) {
      showMessage("API key should start with 'sp_'", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      await chrome.storage.sync.set({ apiKey });
      updateStatus(true);
      showMessage("API key saved successfully!", "success");
    } catch (error) {
      showMessage("Failed to save API key", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  });

  // Clear API key
  clearBtn.addEventListener("click", async () => {
    await chrome.storage.sync.remove(["apiKey"]);
    apiKeyInput.value = "";
    updateStatus(false);
    showMessage("API key cleared", "success");
  });

  // Update connection status
  function updateStatus(connected) {
    statusEl.className = `status ${connected ? "connected" : "disconnected"}`;
    statusEl.querySelector(".status-text").textContent = connected
      ? "Connected"
      : "Not connected";
  }

  // Show message
  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      messageEl.className = "message hidden";
    }, 3000);
  }
});
