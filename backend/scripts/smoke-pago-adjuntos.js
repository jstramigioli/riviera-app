/**
 * Smoke: retirado + adjuntos FACTURA/COMPROBANTE en un pago de prueba.
 * Uso: node scripts/smoke-pago-adjuntos.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const {
  ADJUNTO_TIPOS,
  saveUploadedFile,
  deleteStoredFile,
  assertMimeForTipo
} = require('../src/utils/pagoAdjuntos');

const prisma = new PrismaClient();

async function main() {
  const pago = await prisma.pago.findFirst({
    where: { requiereFacturacion: true },
    orderBy: { id: 'desc' }
  });
  if (!pago) {
    throw new Error('No hay pago con requiereFacturacion=true para probar');
  }

  const pdfBytes = Buffer.from(
    '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
    'utf8'
  );
  const mimeCheck = assertMimeForTipo(ADJUNTO_TIPOS.FACTURA, 'application/pdf');
  if (mimeCheck.error) throw new Error(mimeCheck.error);

  const saved = saveUploadedFile(
    pago.id,
    {
      buffer: pdfBytes,
      mimetype: 'application/pdf',
      originalname: 'smoke-factura.pdf',
      size: pdfBytes.length
    },
    ADJUNTO_TIPOS.FACTURA
  );

  const adjunto = await prisma.pagoAdjunto.create({
    data: {
      pagoId: pago.id,
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
    'pago-adjuntos',
    String(pago.id),
    adjunto.storedName
  );
  if (!fs.existsSync(filePath)) {
    throw new Error('Archivo no quedó en disco');
  }

  if (!isTransferencia(pago.metodo)) {
    await prisma.pago.update({
      where: { id: pago.id },
      data: { retirado: true }
    });
    await prisma.pago.update({
      where: { id: pago.id },
      data: { retirado: false }
    });
  }

  await prisma.pagoAdjunto.delete({ where: { id: adjunto.id } });
  deleteStoredFile(pago.id, adjunto.storedName);

  console.log(
    JSON.stringify(
      {
        ok: true,
        pagoId: pago.id,
        metodo: pago.metodo,
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
