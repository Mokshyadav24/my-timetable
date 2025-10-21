/* drive.js — Google Drive Sync for Timetable App */

const CLIENT_ID = "294789489033-do1ba857c5ns6l2vfmq33brj9o5pobeo.apps.googleusercontent.com";
const API_KEY = "AIzaSyBVrC5ateQ9k7hbEKODNVN8pEqFriLWums";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

let gapiLoaded = false;
let tokenClient = null;
let isReady = false;
let currentFileId = null;

export async function initGoogleDrive() {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById("gapi-script");
    if (existingScript) return resolve(loadDriveAPI());

    const script = document.createElement("script");
    script.id = "gapi-script";
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => loadDriveAPI().then(resolve).catch(reject);
    document.body.appendChild(script);
  });
}

async function loadDriveAPI() {
  if (gapiLoaded) return;
  gapiLoaded = true;
  await new Promise((resolve) => window.gapi.load("client", resolve));
  await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: DISCOVERY_DOCS });
  return initAuth();
}

function initAuth() {
  return new Promise((resolve) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          isReady = true;
          resolve();
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

async function ensureFileExists() {
  const res = await gapi.client.drive.files.list({
    q: "name='timetable_data_v2.json' and trashed=false",
    fields: "files(id, name)",
    spaces: "appDataFolder",
  });
  if (res.result.files && res.result.files.length > 0) {
    currentFileId = res.result.files[0].id;
    return currentFileId;
  }

  const createRes = await gapi.client.drive.files.create({
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
    const res = await gapi.client.drive.files.get({ fileId, alt: "media" });
    return JSON.parse(res.body);
  } catch (e) {
    console.warn("Creating fresh file", e);
    await saveDriveData({ tasks: [], history: {}, lastActiveDate: new Date().toISOString().slice(0, 10) });
    return { tasks: [], history: {}, lastActiveDate: new Date().toISOString().slice(0, 10) };
  }
}

export async function saveDriveData(data) {
  if (!isReady) await initGoogleDrive();
  const fileId = await ensureFileExists();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const metadata = { name: "timetable_data_v2.json" };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob);
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
    method: "PATCH",
    headers: new Headers({ Authorization: "Bearer " + gapi.client.getToken().access_token }),
    body: form,
  });
}
