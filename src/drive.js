/* src/drive.js — Google Drive Sync for Timetable App (client-side) */

/*
- CLIENT_ID and API_KEY here are the values you provided earlier.
- The code uses Google Drive appDataFolder (private to the app) to store timetable_data_v2.json.
- Behavior: silent token request on load; will prompt consent on first run if needed.
*/

const CLIENT_ID = "294789489033-do1ba857c5ns6l2vfmq33brj9o5pobeo.apps.googleusercontent.com";
const API_KEY = "AIzaSyBVrC5ateQ9k7hbEKODNVN8pEqFriLWums";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

let isReady = false;
let tokenClient = null;
let currentFileId = null;

export async function initGoogleDrive() {
  if (isReady) return;
  await loadGapi();
  await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: DISCOVERY_DOCS });
  await initTokenClient();
  isReady = true;
}

function loadGapi() {
  return new Promise((resolve, reject) => {
    if (window.gapi) return resolve();
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initTokenClient() {
  await loadGis();
  if (tokenClient) return;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      // gapi will be updated with the token via gapi.auth.setToken below when available
      if (resp && resp.access_token) {
        try { window.gapi.auth.setToken({ access_token: resp.access_token }); } catch (e) {}
      }
    },
  });

  // try silent request (no prompt). If it fails, the library will throw and we fallback to interactive consent.
  try {
    tokenClient.requestAccessToken({ prompt: "" });
  } catch (e) {
    // fallback interactive
    tokenClient.requestAccessToken({ prompt: "consent" });
  }
}

async function ensureFileExists() {
  // search in appDataFolder for our file
  const res = await window.gapi.client.drive.files.list({
    q: "name='timetable_data_v2.json' and trashed=false",
    fields: "files(id, name)",
    spaces: "appDataFolder",
  });
  if (res.result && res.result.files && res.result.files.length > 0) {
    currentFileId = res.result.files[0].id;
    return currentFileId;
  }
  // create file in appDataFolder
  const createRes = await window.gapi.client.drive.files.create({
    resource: {
      name: "timetable_data_v2.json",
      parents: ["appDataFolder"],
      mimeType: "application/json",
    },
    fields: "id",
  });
  currentFileId = createRes.result.id;
  return currentFileId;
}

export async function loadDriveData() {
  if (!isReady) await initGoogleDrive();
  const fileId = await ensureFileExists();
  try {
    const res = await window.gapi.client.drive.files.get({ fileId, alt: 'media' });
    // gapi returns the file content in res.body
    if (res && res.body) return JSON.parse(res.body);
    // fallback (shouldn't be needed)
    const token = window.gapi.client.getToken().access_token;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    return await r.json();
  } catch (err) {
    // if empty/invalid, create initial structure and return it
    const initial = { tasks: [], history: {}, lastActiveDate: new Date().toISOString().slice(0,10) };
    await saveDriveData(initial);
    return initial;
  }
}

export async function saveDriveData(data) {
  if (!isReady) await initGoogleDrive();
  const fileId = await ensureFileExists();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const metadata = { name: 'timetable_data_v2.json' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const tokenObj = window.gapi.client.getToken();
  const token = tokenObj ? tokenObj.access_token : null;
  if (!token) {
    // ensure token available (force user consent)
    tokenClient.requestAccessToken({ prompt: "consent" });
    throw new Error('No access token available yet; user interaction required.');
  }

  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  });
}
