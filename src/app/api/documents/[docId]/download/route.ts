import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getDocumentForDownload } from '@/lib/services/documentService';

export async function GET(
  _request: Request,
  context: { params: Promise<{ docId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
    }

    const { docId } = await context.params;
    const { record, buffer } = getDocumentForDownload(user, docId);

    const safeName = encodeURIComponent(record.original_name);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': record.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Archivo no encontrado.';
    return NextResponse.json({ success: false, message }, { status: 404 });
  }
}
