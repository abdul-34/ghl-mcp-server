/**
 * Page-world extractor for Firebase IndexedDB credentials.
 * Runs via chrome.scripting.executeScript({ world: "MAIN" }).
 */
export async function extractFirebaseCredentials() {
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

    if (!storeName) {
      throw new Error(`No object store found in ${DATABASE_NAME}`);
    }

    const records = await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('getAll failed'));
    });

    const credentials = [];
    for (const record of records) {
      const storageKey = record.fbase_key ?? record.key ?? '';
      let user = record.value ?? record;
      if (typeof user === 'string') {
        try {
          user = JSON.parse(user);
        } catch {
          continue;
        }
      }

      const keyMatch = String(storageKey).match(/^firebase:authUser:([^:]+):/);
      const firebaseApiKey =
        user?.apiKey ??
        user?.config?.apiKey ??
        keyMatch?.[1];
      const firebaseRefreshToken =
        user?.stsTokenManager?.refreshToken ??
        user?.refreshToken;
      const accessToken = user?.stsTokenManager?.accessToken ?? user?.accessToken;
      const expirationTime = user?.stsTokenManager?.expirationTime;

      if (!firebaseApiKey || !firebaseRefreshToken) continue;

      credentials.push({
        firebaseApiKey,
        firebaseRefreshToken,
        accessToken: accessToken || undefined,
        expirationTime: expirationTime || undefined,
        storageKey: String(storageKey),
      });
    }

    return {
      ok: true,
      origin: location.origin,
      href: location.href,
      credentials,
    };
  } finally {
    database.close();
  }
}

/**
 * Best-effort location / company context from the open CRM URL or globals.
 */
export function extractAccountContext() {
  const href = location.href;
  const locationMatch =
    href.match(/\/location\/([A-Za-z0-9]+)/) ||
    href.match(/[?&]locationId=([A-Za-z0-9]+)/);
  const companyMatch = href.match(/[?&]companyId=([A-Za-z0-9]+)/);

  let companyId;
  let userId;
  try {
    const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (raw) {
      const parsed = JSON.parse(raw);
      companyId = parsed?.companyId || parsed?.company_id || companyId;
      userId = parsed?.id || parsed?.userId || parsed?.user_id || userId;
    }
  } catch {
    // ignore
  }

  return {
    locationId: locationMatch?.[1],
    companyId: companyMatch?.[1] || companyId,
    userId,
    href,
    origin: location.origin,
  };
}
