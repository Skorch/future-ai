import { auth } from '@/app/(auth)/auth';
import { getDocumentsById } from '@/lib/db/queries';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

const getExtension = (kind: string) => {
  const extensions: Record<string, string> = {
    text: 'md',
    code: 'txt',
    sheet: 'csv',
    image: 'png',
  };
  return extensions[kind] || 'txt';
};

const prepareContent = (content: string, kind: string): Buffer | string => {
  if (kind === 'image') {
    // Convert base64 to binary for images
    const base64Data = content.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }
  if (kind === 'sheet') {
    // Convert JSON array to CSV (assuming simple structure)
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map((row) => Object.values(row).join(','));
        return [headers, ...rows].join('\n');
      }
    } catch {}
  }
  // Text and code remain as-is
  return content;
};

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const documents = await getDocumentsById({ id: params.id });
  const [document] = documents;

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const path = `docs/${session.user.id}/${document.id}.${getExtension(document.kind)}`;
  const content = prepareContent(document.content || '', document.kind);
  // addRandomSuffix: false ensures the file is overwritten at the same path
  const blob = await put(path, content, {
    access: 'public',
    addRandomSuffix: false,
  });

  return NextResponse.json({ success: true, path: blob.pathname });
}
