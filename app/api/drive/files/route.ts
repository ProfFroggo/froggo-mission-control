// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/drive/files?folderId=root&pageToken= — list Google Drive files/folders
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/googleAuth';

export const runtime = 'nodejs';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function driveIconColor(mimeType: string): string {
  if (mimeType === FOLDER_MIME) return 'folder';
  if (mimeType.includes('document')) return 'doc';
  if (mimeType.includes('spreadsheet')) return 'sheet';
  if (mimeType.includes('presentation')) return 'slides';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'file';
}

export async function GET(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId') || 'root';
  const pageToken = searchParams.get('pageToken') || undefined;
  const q = searchParams.get('q') || '';

  try {
    const drive = google.drive({ version: 'v3', auth: client });

    // Build query: list items in the specified folder
    let query = `'${folderId}' in parents and trashed = false`;
    if (q) query += ` and name contains '${q.replace(/'/g, "\\'")}'`;

    const res = await drive.files.list({
      q: query,
      fields: 'nextPageToken, files(id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink)',
      orderBy: 'folder,name',
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });

    const rawFiles = res.data.files ?? [];
    const files = rawFiles.map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      isFolder: f.mimeType === FOLDER_MIME,
      size: f.size ? parseInt(f.size) : null,
      modifiedTime: f.modifiedTime,
      createdTime: f.createdTime,
      webViewLink: f.webViewLink,
      kind: driveIconColor(f.mimeType ?? ''),
    }));

    // Get folder metadata for breadcrumb (name of current folder)
    let folderName = 'My Drive';
    if (folderId !== 'root') {
      try {
        const meta = await drive.files.get({ fileId: folderId, fields: 'id,name,parents' });
        folderName = meta.data.name ?? folderId;
      } catch { /* non-critical */ }
    }

    return NextResponse.json({
      files,
      folderId,
      folderName,
      nextPageToken: res.data.nextPageToken ?? null,
    });
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    console.error('[drive/files] Error:', msg);
    const isAuthError = msg.includes('invalid_grant') || msg.includes('unauthorized') || msg.includes('401');
    if (isAuthError) {
      return NextResponse.json({ error: msg, needsAuth: true }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
