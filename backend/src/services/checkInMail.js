/**
 * Envío de link de check-in online.
 * Si hay SMTP_* configurado y nodemailer instalado, intenta enviar.
 * Si no, el caller usa mailto / copia del link.
 */

function buildCheckInUrl(token) {
  const base = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173')
    .replace(/\/$/, '');
  return `${base}/check-in/${token}`;
}

function buildMailto({ to, guestName, checkInUrl, reservationId }) {
  if (!to) return null;
  const subject = encodeURIComponent(`Check-in online — Hotel Riviera (reserva #${reservationId})`);
  const body = encodeURIComponent(
    [
      `Hola${guestName ? ` ${guestName}` : ''},`,
      '',
      'Para agilizar tu llegada, completá el check-in online con este enlace:',
      checkInUrl,
      '',
      'Si algún dato ya figura, solo corregilo si hace falta.',
      '',
      'Hotel Riviera'
    ].join('\n')
  );
  return `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
}

async function sendCheckInEmail({ to, guestName, checkInUrl, reservationId }) {
  const host = process.env.SMTP_HOST;
  if (!host || !to) {
    return { emailed: false, reason: host ? 'missing_to' : 'smtp_not_configured' };
  }

  let nodemailer;
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    nodemailer = require('nodemailer');
  } catch {
    return { emailed: false, reason: 'nodemailer_missing' };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || 'noreply@hotelriviera.local';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined
  });

  await transporter.sendMail({
    from,
    to,
    subject: `Check-in online — Hotel Riviera (reserva #${reservationId})`,
    text: [
      `Hola${guestName ? ` ${guestName}` : ''},`,
      '',
      'Para agilizar tu llegada, completá el check-in online con este enlace:',
      checkInUrl,
      '',
      'Si algún dato ya figura, solo corregilo si hace falta.',
      '',
      'Hotel Riviera'
    ].join('\n'),
    html: `
      <p>Hola${guestName ? ` ${guestName}` : ''},</p>
      <p>Para agilizar tu llegada, completá el check-in online:</p>
      <p><a href="${checkInUrl}">${checkInUrl}</a></p>
      <p>Si algún dato ya figura, solo corregilo si hace falta.</p>
      <p>Hotel Riviera</p>
    `
  });

  return { emailed: true };
}

module.exports = {
  buildCheckInUrl,
  buildMailto,
  sendCheckInEmail
};
