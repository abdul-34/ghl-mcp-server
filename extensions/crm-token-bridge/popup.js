const serverStatusEl = document.getElementById('serverStatus');
const lastIngestEl = document.getElementById('lastIngest');
const messageEl = document.getElementById('message');
const captureBtn = document.getElementById('captureBtn');
const optionsBtn = document.getElementById('optionsBtn');

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.className = isError ? 'err' : 'ok';
}

async function refreshStatus() {
  const stored = await chrome.storage.local.get(['lastIngest']);
  lastIngestEl.textContent = stored.lastIngest?.at
    ? new Date(stored.lastIngest.at).toLocaleString()
    : '—';

  chrome.runtime.sendMessage({ type: 'SERVER_STATUS' }, (response) => {
    if (chrome.runtime.lastError) {
      serverStatusEl.textContent = 'Unavailable';
      serverStatusEl.className = 'err';
      return;
    }
    if (!response?.ok) {
      serverStatusEl.textContent = response?.error || 'Down';
      serverStatusEl.className = 'err';
      return;
    }
    serverStatusEl.textContent = response.result?.status || 'ok';
    serverStatusEl.className = 'ok';
  });
}

captureBtn.addEventListener('click', () => {
  captureBtn.disabled = true;
  setMessage('Capturing…');
  chrome.runtime.sendMessage({ type: 'CAPTURE_ACTIVE_TAB' }, (response) => {
    captureBtn.disabled = false;
    if (chrome.runtime.lastError) {
      setMessage(chrome.runtime.lastError.message, true);
      return;
    }
    if (!response?.ok) {
      setMessage(response?.error || 'Capture failed', true);
      return;
    }
    const r = response.result;
    setMessage(
      `Captured Firebase credentials` +
        (r.locationId ? ` for location ${r.locationId}` : '') +
        `. Stored on the server.`
    );
    refreshStatus();
  });
});

optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

refreshStatus();
