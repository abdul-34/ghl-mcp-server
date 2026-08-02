// CRM Token Bridge — captures a logged-in GHL session's Firebase credentials
// from IndexedDB and posts them to the self-hosted MCP server's /capture
// endpoint, which stores them (encrypted) on the matching sub-account row.
//
// The capture token (issued in the MCP dashboard) authenticates the push; it
// resolves to the agency owner server-side. Nothing is stored locally beyond
// the server URL, the capture token, and the last sniffed builder JWT.

const DEFAULT_SERVER_URL = 'http://localhost:8000';

async function getSettings() {
  const stored = await chrome.storage.local.get([
    'serverUrl',
    'captureToken',
    'lastIngest',
    'lastBuilderTokenAt',
  ]);
  return {
    serverUrl: (stored.serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, ''),
    captureToken: stored.captureToken || '',
    lastIngest: stored.lastIngest || null,
    lastBuilderTokenAt: stored.lastBuilderTokenAt || null,
  };
}

// Continuously push the sniffed builder JWT to the agency-level endpoint (no
// location context). Best-effort and silent when unconfigured — this is what
// keeps the marketplace-discovery tools fresh without any manual step.
async function postBuilderCapture(authToken) {
  const { serverUrl, captureToken } = await getSettings();
  if (!captureToken || !authToken) return false;

  const response = await fetch(`${serverUrl}/capture/builder/${encodeURIComponent(captureToken)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Capture-Token': captureToken,
    },
    body: JSON.stringify({
      authToken,
      capturedAt: new Date().toISOString(),
      source: 'crm-token-bridge-extension',
    }),
  });
  if (response.ok) {
    await chrome.storage.local.set({ lastBuilderPushAt: new Date().toISOString() });
  }
  return response.ok;
}

async function postCapture(payload) {
  const { serverUrl, captureToken } = await getSettings();
  if (!captureToken) {
    throw new Error('Set the capture token in extension options first.');
  }

  const response = await fetch(`${serverUrl}/capture/${encodeURIComponent(captureToken)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Capture-Token': captureToken,
    },
    body: JSON.stringify({
      ...payload,
      capturedAt: new Date().toISOString(),
      source: 'crm-token-bridge-extension',
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data.error || `Capture failed (${response.status})`);
  }

  await chrome.storage.local.set({
    lastIngest: { at: new Date().toISOString(), summary: data.summary || data },
  });

  return data;
}

function isInterestingUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('leadconnectorhq.com') || u.hostname.endsWith('gohighlevel.com');
  } catch {
    return false;
  }
}

function pickBearer(headers) {
  if (!headers) return null;
  for (const header of headers) {
    if (!header?.name || !header?.value) continue;
    if (header.name.toLowerCase() !== 'authorization') continue;
    const match = header.value.match(/^Bearer\s+(.+)$/i);
    if (match?.[1] && match[1].split('.').length === 3) {
      return match[1].trim();
    }
  }
  return null;
}

// Sniff the builder JWT from CRM API requests and, whenever it changes, push it
// to the agency-level endpoint so the server always holds a fresh builder token.
// GHL rotates this JWT ~hourly, so pushes are rare (deduped on the token value).
// The GHL API hosts are NOT white-labeled, so this fires even when the agency's
// CRM app runs on a custom domain.
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!isInterestingUrl(details.url)) return;
    const token = pickBearer(details.requestHeaders);
    if (!token) return;

    chrome.storage.local.get(['lastBuilderToken']).then(async (stored) => {
      if (stored.lastBuilderToken === token) return;
      await chrome.storage.local.set({
        lastBuilderToken: token,
        lastBuilderTokenAt: new Date().toISOString(),
      });
      try {
        await postBuilderCapture(token);
      } catch {
        // best-effort — the token is still stored locally for the next Firebase capture
      }
    });
  },
  {
    urls: ['https://*.leadconnectorhq.com/*', 'https://*.gohighlevel.com/*'],
  },
  ['requestHeaders', 'extraHeaders']
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'CAPTURE_ACTIVE_TAB') {
    captureActiveTab()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'SERVER_STATUS') {
    checkServer()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function checkServer() {
  const { serverUrl } = await getSettings();
  const response = await fetch(`${serverUrl}/health`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Server health failed (${response.status})`);
  }
  return data;
}

async function captureActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    throw new Error('No active CRM tab found.');
  }

  // No hostname gate: most HighLevel agencies are fully white-labeled and run the
  // CRM on their own custom domain. We read the Firebase IndexedDB from whatever
  // tab is active and rely on that read (below) to confirm it's a CRM session.
  if (!/^https?:/i.test(tab.url)) {
    throw new Error('Open your CRM app tab (the logged-in HighLevel/white-label dashboard) first.');
  }

  const [{ result: firebaseResult }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: async () => {
      const DATABASE_NAME = 'firebaseLocalStorageDb';
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('indexedDB open failed'));
      });

      try {
        const storeName = database.objectStoreNames.contains('firebaseLocalStorage')
          ? 'firebaseLocalStorage'
          : database.objectStoreNames[0];
        if (!storeName) throw new Error(`No object store in ${DATABASE_NAME}`);

        const records = await new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error || new Error('getAll failed'));
        });

        const credentials = [];
        for (const record of records) {
          const storageKey = record.fbase_key ?? record.key ?? '';
          let user = record.value ?? record;
          if (typeof user === 'string') {
            try { user = JSON.parse(user); } catch { continue; }
          }
          const keyMatch = String(storageKey).match(/^firebase:authUser:([^:]+):/);
          const firebaseApiKey = user?.apiKey ?? user?.config?.apiKey ?? keyMatch?.[1];
          const firebaseRefreshToken = user?.stsTokenManager?.refreshToken ?? user?.refreshToken;
          if (!firebaseApiKey || !firebaseRefreshToken) continue;
          credentials.push({
            firebaseApiKey,
            firebaseRefreshToken,
            accessToken: user?.stsTokenManager?.accessToken,
            expirationTime: user?.stsTokenManager?.expirationTime,
          });
        }

        const href = location.href;
        const locationMatch = href.match(/\/location\/([A-Za-z0-9]+)/);
        let companyId;
        let userId;
        try {
          const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
          if (raw) {
            const parsed = JSON.parse(raw);
            companyId = parsed?.companyId || parsed?.company_id;
            userId = parsed?.id || parsed?.userId || parsed?.user_id;
          }
        } catch {}

        return {
          ok: true,
          origin: location.origin,
          href,
          credentials,
          context: { locationId: locationMatch?.[1], companyId, userId },
        };
      } finally {
        database.close();
      }
    },
  });

  if (!firebaseResult?.ok) {
    throw new Error('Failed to read Firebase IndexedDB from this tab.');
  }
  if (!firebaseResult.credentials?.length) {
    throw new Error('No Firebase credentials found. Sign in to the CRM and retry.');
  }
  // No locationId needed: the Firebase session is the logged-in USER's and is
  // identical across every sub-account, so the server stores it once at the agency
  // level. Capture from any logged-in CRM tab (the agency dashboard is fine).

  // Prefer the newest / first credential set.
  const cred = firebaseResult.credentials[0];
  const stored = await chrome.storage.local.get(['lastBuilderToken']);

  const result = await postCapture({
    captureKind: 'firebase_indexeddb',
    firebaseApiKey: cred.firebaseApiKey,
    firebaseRefreshToken: cred.firebaseRefreshToken,
    firebaseIdToken: cred.accessToken,
    authToken: stored.lastBuilderToken || undefined,
    locationId: firebaseResult.context?.locationId,
    companyId: firebaseResult.context?.companyId,
    userId: firebaseResult.context?.userId,
    pageUrl: firebaseResult.href,
  });

  return {
    firebaseCount: firebaseResult.credentials.length,
    locationId: firebaseResult.context?.locationId,
    companyId: firebaseResult.context?.companyId,
    server: result,
  };
}
