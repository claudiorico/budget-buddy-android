import { storage } from './storage';

const BASE = 'https://www.googleapis.com';
const UPLOAD_BASE = 'https://www.googleapis.com/upload';

type DriveFile = { id: string; name: string; modifiedTime: string };

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function listAppDataFiles(token: string): Promise<DriveFile[]> {
  const url =
    `${BASE}/drive/v3/files` +
    `?spaces=appDataFolder&fields=files(id,name,modifiedTime)`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const json = await res.json();
  return json.files as DriveFile[];
}

export async function downloadFile(token: string, fileId: string): Promise<string> {
  const url = `${BASE}/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.text();
}

export async function createFile(
  token: string,
  name: string,
  content: string,
): Promise<string> {
  const boundary = '-------314159265358979323846';
  const metadata = JSON.stringify({ name, parents: ['appDataFolder'] });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `${UPLOAD_BASE}/drive/v3/files?uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
  const json = await res.json();
  storage.set(`driveId:${name}`, json.id as string);
  return json.id as string;
}

export async function updateFile(
  token: string,
  fileId: string,
  content: string,
): Promise<void> {
  const res = await fetch(
    `${UPLOAD_BASE}/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        ...authHeader(token),
        'Content-Type': 'application/json',
      },
      body: content,
    },
  );
  if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
}

export async function deleteFile(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${BASE}/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!res.ok && res.status !== 204) throw new Error(`Drive delete failed: ${res.status}`);
}

// High-level helpers — use MMKV ID cache, create or update as needed

export async function writeFile(
  token: string,
  name: string,
  data: unknown,
): Promise<void> {
  const content = JSON.stringify(data);
  const cachedId = storage.getString(`driveId:${name}`);
  if (cachedId) {
    await updateFile(token, cachedId, content);
  } else {
    await createFile(token, name, content);
  }
}

export async function readFile<T>(
  token: string,
  name: string,
  files?: DriveFile[],
): Promise<T | null> {
  let fileId = storage.getString(`driveId:${name}`);
  if (!fileId) {
    const list = files ?? (await listAppDataFiles(token));
    const found = list.find(f => f.name === name);
    if (!found) return null;
    fileId = found.id;
    storage.set(`driveId:${name}`, fileId);
  }
  const text = await downloadFile(token, fileId);
  return JSON.parse(text) as T;
}

export async function syncFileIds(token: string): Promise<void> {
  const files = await listAppDataFiles(token);
  for (const f of files) {
    storage.set(`driveId:${f.name}`, f.id);
  }
}
