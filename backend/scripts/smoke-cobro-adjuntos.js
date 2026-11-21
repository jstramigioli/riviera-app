/**
 * Smoke: retirado + adjuntos FACTURA/COMPROBANTE en un cobro de prueba.
 * Uso: node scripts/smoke-cobro-adjuntos.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const {
  ADJUNTO_TIPOS,
  saveUploadedFile,
  deleteStoredFile,
  assertMimeForTipo
} = require('../src/utils/cobroAdjuntos');

const prisma = new PrismaClient();

async function main() {
  const cobro = await prisma.cobro.findFirst({
    where: { requiereFacturacion: true },
    orderBy: { id: 'desc' }
  });
  if (!cobro) {
    throw new Error('No hay cobro con requiereFacturacion=true para probar');
  }

  const pdfBytes = Buffer.from(
    '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
    'utf8'
  );
  const mimeCheck = assertMimeForTipo(ADJUNTO_TIPOS.FACTURA, 'application/pdf');
  if (mimeCheck.error) throw new Error(mimeCheck.error);

  const saved = saveUploadedFile(
    cobro.id,
    {
      buffer: pdfBytes,
      mimetype: 'application/pdf',
      originalname: 'smoke-factura.pdf',
      size: pdfBytes.length
    },
    ADJUNTO_TIPOS.FACTURA
  );

  const adjunto = await prisma.cobroAdjunto.create({
    data: {
      cobroId: cobro.id,
      tipo: saved.tipo,
      originalName: saved.originalName,
      storedName: saved.storedName,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes
    }
  });

  const filePath = path.join(
    __dirname,
    '..',
    'uploads',
    'cobro-adjuntos',
    String(cobro.id),
    adjunto.storedName
  );
  if (!fs.existsSync(filePath)) {
    throw new Error('Archivo no quedó en disco');
  }

  if (!isTransferencia(cobro.metodo)) {
    await prisma.cobro.update({
      where: { id: cobro.id },
      data: { retirado: true }
    });
    await prisma.cobro.update({
      where: { id: cobro.id },
      data: { retirado: false }
    });
  }

  await prisma.cobroAdjunto.delete({ where: { id: adjunto.id } });
  deleteStoredFile(cobro.id, adjunto.storedName);

  console.log(
    JSON.stringify(
      {
        ok: true,
        cobroId: cobro.id,
        metodo: cobro.metodo,
        adjuntoId: adjunto.id,
        tipo: adjunto.tipo
      },
      null,
      2
    )
  );
}

function isTransferencia(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'transferencia';
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
