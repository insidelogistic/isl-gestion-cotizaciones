import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { listExpedienteDocuments, uploadExpedienteDocument } from '@/lib/services/documentService';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const documents = listExpedienteDocuments(id);
  return NextResponse.json({ success: true, documents });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const document = uploadExpedienteDocument(user, {
      request_id: id,
      revision_id: body.revision_id || null,
      activity_id: body.activity_id || null,
      closure_id: body.closure_id || null,
      category: body.category || 'OTRO',
      original_name: body.original_name || body.file_name || 'archivo.bin',
      mime_type: body.mime_type || 'application/octet-stream',
      content_base64: body.content_base64,
    });

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al subir el documento.';
    const status = message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
