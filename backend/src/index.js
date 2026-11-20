require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const app = require('./app');

const PORT = Number(process.env.PORT) || 3001;
const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV !== 'production' && !isTest;

const prisma = new PrismaClient();

function describeDatabaseUrl(url = process.env.DATABASE_URL || '') {
  const m = String(url).match(/^"?postgresql:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^\s"'?]+)/);
  if (!m) return { ok: false, summary: url ? '(unparseable DATABASE_URL)' : '(missing DATABASE_URL)' };
  return {
    ok: true,
    user: m[1],
    host: m[3],
    port: m[4] || '5432',
    db: m[5],
    summary: `${m[1]}@${m[3]}:${m[4] || '5432'}/${m[5]}`,
  };
}

async function testDbConnection({ retries = isDev ? 12 : 1, delayMs = 2500 } = {}) {
  const target = describeDatabaseUrl();
  console.log(`🗄️  DB target: ${target.summary}`);
  if (isDev && target.ok && target.db !== 'riviera_v1') {
    console.warn(
      `⚠️  DATABASE_URL apunta a "${target.db}" (esperado en preview local: riviera_v1). ` +
        'Si el FE muestra Failed to fetch tras un merge, revisá backend/.env.'
    );
  }

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await prisma.$connect();
      console.log('Conexión a la base de datos exitosa');
      return;
    } catch (error) {
      lastError = error;
      const code = error.code || error.errorCode || '';
      console.error(
        `Error al conectar con la base de datos (${code || 'sin código'}) ` +
          `[intento ${attempt}/${retries}] → ${target.summary}`
      );
      console.error(error.message || error);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  if (!isTest) {
    process.exit(1);
  }
  throw lastError;
}

async function start() {
  await testDbConnection();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📊 API disponible en http://localhost:${PORT}/api`);
    console.log(`🏥 Health check en http://localhost:${PORT}/api/health`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Puerto ${PORT} en uso (EADDRINUSE). Suele quedar un node zombie tras un crash de nodemon. ` +
          `Liberá el puerto y reiniciá el backend.`
      );
      process.exit(1);
      return;
    }
    console.error('Error del servidor HTTP:', err);
    process.exit(1);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} recibido, cerrando...`);
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('No se pudo iniciar el backend:', err);
  process.exit(1);
});
