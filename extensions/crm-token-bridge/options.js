const serverUrlEl = document.getElementById('serverUrl');
const captureTokenEl = document.getElementById('captureToken');
const savedEl = document.getElementById('saved');

chrome.storage.local.get(['serverUrl', 'captureToken']).then((stored) => {
  serverUrlEl.value = stored.serverUrl || 'http://localhost:8000';
  captureTokenEl.value = stored.captureToken || '';
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({
    serverUrl: serverUrlEl.value.trim().replace(/\/$/, '') || 'http://localhost:8000',
    captureToken: captureTokenEl.value.trim(),
  });
  savedEl.textContent = 'Saved.';
});
