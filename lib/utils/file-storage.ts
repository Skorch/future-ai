import { generateUUID } from '../utils';

export function generateStoragePath({
  userId,
  chatId,
  filename,
}: {
  userId: string;
  chatId: string;
  filename: string;
}): string {
  const fileId = generateUUID();
  const lastDotIndex = filename.lastIndexOf('.');
  const extension =
    lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : 'bin';
  return `${userId}/${chatId}/${fileId}.${extension}`;
}

export function parseStoragePath(path: string): {
  userId: string;
  chatId: string;
  fileId: string;
} | null {
  const parts = path.split('/');
  if (parts.length !== 3) return null;

  const [userId, chatId, fileWithExt] = parts;
  const fileId = fileWithExt.split('.')[0];

  return { userId, chatId, fileId };
}
