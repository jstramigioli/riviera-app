const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function createFullBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(__dirname, 'backups');
  
  // Crear directorio de backups si no existe
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const sqlBackupFile = path.join(backupDir, `backup_completo_${timestamp}.sql`);
  const jsonBackupDir = path.join(backupDir, `json_backup_${timestamp}`);
  
  console.log('🗄️ Iniciando backup completo de la base de datos...');
  console.log(`📁 Ubicación SQL: ${sqlBackupFile}`);
  console.log(`📁 Ubicación JSON: ${jsonBackupDir}`);

  try {
    // 1. Backup SQL usando pg_dump (principal)
    console.log('\n📦 Creando backup SQL con pg_dump...');
    
    // Obtener configuración de la base de datos del schema.prisma
    const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
    let databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      // Intentar leer desde .env local si existe
      const envPath = path.join(__dirname, '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/DATABASE_URL\s*=\s*"?([^"\n]+)"?/);
        if (match) {
          databaseUrl = match[1];
        }
      }
    }

    // Si no encuentra DATABASE_URL, usar configuración por defecto típica
    if (!databaseUrl) {
      databaseUrl = 'postgresql://postgres:password@localhost:5432/riviera_hotel';
      console.log('⚠️  DATABASE_URL no encontrada, usando configuración por defecto');
      console.log('⚠️  Si falla, verifica tu configuración de base de datos');
    }

    // Parsear la URL de la base de datos
    const url = new URL(databaseUrl);
    const dbName = url.pathname.slice(1);
    const username = url.username;
    const password = url.password;
    const host = url.hostname;
    const port = url.port || 5432;

    console.log(`🔗 Conectando a: ${username}@${host}:${port}/${dbName}`);

    // Configurar variables de entorno para pg_dump
    const env = {
      ...process.env,
      PGPASSWORD: password,
    };

    // Comando pg_dump completo con todas las opciones
    const pgDumpCommand = `pg_dump -h ${host} -p ${port} -U ${username} -d ${dbName} --verbose --clean --create --if-exists --format=plain --no-owner --no-privileges --file="${sqlBackupFile}"`;

    await new Promise((resolve, reject) => {
      exec(pgDumpCommand, { env }, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Error en pg_dump:', error.message);
          
          // Si falla pg_dump, intentar una alternativa más simple
          console.log('\n🔄 Intentando backup alternativo con pg_dump simplificado...');
          const simplePgDump = `pg_dump -h ${host} -p ${port} -U ${username} ${dbName} > "${sqlBackupFile}"`;
          
          exec(simplePgDump, { env }, (error2, stdout2, stderr2) => {
            if (error2) {
              console.error('❌ Error en backup alternativo:', error2.message);
              reject(error2);
            } else {
              console.log('✅ Backup SQL alternativo completado');
              resolve();
            }
          });
        } else {
          console.log('✅ Backup SQL completado exitosamente');
          if (stderr) console.log('📝 Detalles:', stderr);
          resolve();
        }
      });
    });

    // 2. Verificar que el archivo se creó correctamente
    if (fs.existsSync(sqlBackupFile)) {
      const stats = fs.statSync(sqlBackupFile);
      console.log(`📊 Tamaño del backup SQL: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
      throw new Error('El archivo de backup SQL no se creó correctamente');
    }

    // 3. Crear backup JSON adicional (usando el script existente)
    console.log('\n📋 Creando backup JSON adicional...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Crear directorio para JSON backup
      if (!fs.existsSync(jsonBackupDir)) {
        fs.mkdirSync(jsonBackupDir, { recursive: true });
      }

      // Backup crítico: Cobros y Cargos (nueva funcionalidad)
      console.log('💰 Respaldando cobros...');
      const cobros = await prisma.cobro.findMany({
        include: {
          reserva: {
            include: {
              mainClient: true
            }
          }
        }
      });
      
      fs.writeFileSync(
        path.join(jsonBackupDir, 'cobros.json'),
        JSON.stringify(cobros, null, 2)
      );
      console.log(`✅ Cobros respaldados: ${cobros.length} registros`);

      console.log('🧾 Respaldando cargos...');
      const cargos = await prisma.cargo.findMany({
        include: {
          reserva: {
            include: {
              mainClient: true
            }
          }
        }
      });
      
      fs.writeFileSync(
        path.join(jsonBackupDir, 'cargos.json'),
        JSON.stringify(cargos, null, 2)
      );
      console.log(`✅ Cargos respaldados: ${cargos.length} registros`);

      // Backup de configuraciones
      console.log('⚙️ Respaldando configuraciones...');
      const configuraciones = await prisma.configuracion.findMany();
      
      fs.writeFileSync(
        path.join(jsonBackupDir, 'configuraciones.json'),
        JSON.stringify(configuraciones, null, 2)
      );
      console.log(`✅ Configuraciones respaldadas: ${configuraciones.length} registros`);

      await prisma.$disconnect();
      
    } catch (jsonError) {
      console.error('⚠️ Error en backup JSON (continuando...):', jsonError.message);
    }

    // 4. Crear script de restauración
    console.log('\n📜 Creando script de restauración...');
    
    const restoreScript = `#!/bin/bash
# Script de restauración automática
# Generado el: ${new Date().toISOString()}

echo "🔄 Iniciando restauración de backup..."
echo "📁 Archivo: ${sqlBackupFile}"

# Configuración de la base de datos
DB_HOST="${host}"
DB_PORT="${port}"
DB_USER="${username}"
DB_NAME="${dbName}"

# Verificar que el archivo existe
if [ ! -f "${sqlBackupFile}" ]; then
    echo "❌ Error: Archivo de backup no encontrado: ${sqlBackupFile}"
    exit 1
fi

echo "⚠️  ADVERTENCIA: Esta operación eliminará todos los datos actuales"
echo "⚠️  ¿Estás seguro de continuar? (escribe 'SI' para continuar)"
read -r confirmation

if [ "$confirmation" != "SI" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo "🗄️ Restaurando base de datos..."

# Método 1: Restauración directa
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < "${sqlBackupFile}"

if [ $? -eq 0 ]; then
    echo "✅ Restauración completada exitosamente"
    echo "🔧 Ejecuta 'npx prisma generate' para actualizar el cliente Prisma"
else
    echo "❌ Error durante la restauración"
    echo "💡 Intenta restaurar manualmente con:"
    echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < '${sqlBackupFile}'"
    exit 1
fi
`;

    const restoreScriptPath = path.join(backupDir, `restore_${timestamp}.sh`);
    fs.writeFileSync(restoreScriptPath, restoreScript);
    
    // Hacer ejecutable el script (solo en Unix-like systems)
    try {
      fs.chmodSync(restoreScriptPath, '755');
    } catch (chmodError) {
      console.log('⚠️ No se pudo hacer ejecutable el script de restauración (normal en Windows)');
    }

    // 5. Crear archivo README con instrucciones
    const readmeContent = `# 🗄️ Backup de Base de Datos Riviera Hotel

## 📋 Información del Backup

- **Fecha de creación**: ${new Date().toISOString()}
- **Tipo**: Backup completo (SQL + JSON)
- **Base de datos**: ${dbName}
- **Servidor**: ${host}:${port}

## 📁 Archivos incluidos

### Backup SQL (Principal)
- **Archivo**: \`${path.basename(sqlBackupFile)}\`
- **Descripción**: Backup completo en formato SQL compatible con PostgreSQL
- **Uso**: Para restauración completa de la base de datos

### Backup JSON (Adicional)
- **Directorio**: \`${path.basename(jsonBackupDir)}/\`
- **Descripción**: Datos en formato JSON para referencia y backup selectivo
- **Archivos incluidos**:
  - \`cobros.json\` - Todos los cobros registrados
  - \`cargos.json\` - Todos los cargos registrados
  - \`configuraciones.json\` - Configuraciones del sistema

## 🔄 Instrucciones de Restauración

### Método 1: Automático (Recomendado)
\`\`\`bash
# Ejecutar el script de restauración
bash ${path.basename(restoreScriptPath)}
\`\`\`

### Método 2: Manual
\`\`\`bash
# 1. Conectar a PostgreSQL
psql -h ${host} -p ${port} -U ${username} -d postgres

# 2. Eliminar base de datos existente (¡CUIDADO!)
DROP DATABASE IF EXISTS ${dbName};

# 3. Crear nueva base de datos
CREATE DATABASE ${dbName};

# 4. Salir de psql
\\q

# 5. Restaurar desde backup
psql -h ${host} -p ${port} -U ${username} -d ${dbName} < ${sqlBackupFile}

# 6. Actualizar Prisma client
cd /ruta/al/proyecto/backend
npx prisma generate
\`\`\`

### Método 3: Usando pg_restore (si aplica)
\`\`\`bash
pg_restore -h ${host} -p ${port} -U ${username} -d ${dbName} --clean --create ${sqlBackupFile}
\`\`\`

## ⚠️ Advertencias Importantes

1. **SIEMPRE** verifica que tengas un backup reciente antes de restaurar
2. La restauración **ELIMINARÁ** todos los datos actuales de la base de datos
3. Asegúrate de que no haya aplicaciones conectadas durante la restauración
4. Después de restaurar, ejecuta \`npx prisma generate\` para actualizar el cliente

## 🆘 En caso de problemas

Si la restauración automática falla:

1. Verifica las credenciales de la base de datos
2. Asegúrate de que PostgreSQL esté ejecutándose
3. Verifica que el usuario tenga permisos para crear/eliminar bases de datos
4. Consulta los logs de PostgreSQL para más detalles

## 📞 Soporte

Para problemas con este backup, consulta:
- Logs de la aplicación
- Documentación de PostgreSQL
- Administrador del sistema
`;

    const readmePath = path.join(backupDir, `BACKUP_README_${timestamp}.md`);
    fs.writeFileSync(readmePath, readmeContent);

    // 6. Crear resumen final
    const backupSummary = {
      timestamp: new Date().toISOString(),
      database: {
        name: dbName,
        host: host,
        port: port,
        user: username
      },
      files: {
        sqlBackup: sqlBackupFile,
        jsonBackupDir: jsonBackupDir,
        restoreScript: restoreScriptPath,
        readme: readmePath
      },
      status: 'completed',
      instructions: `Para restaurar: bash ${restoreScriptPath}`
    };

    fs.writeFileSync(
      path.join(backupDir, `backup_summary_${timestamp}.json`),
      JSON.stringify(backupSummary, null, 2)
    );

    // Mensaje final
    console.log('\n🎉 ¡BACKUP COMPLETO EXITOSO!');
    console.log('═══════════════════════════════════════════════');
    console.log(`📁 Ubicación del backup: ${backupDir}`);
    console.log(`🗄️ Archivo SQL principal: ${path.basename(sqlBackupFile)}`);
    console.log(`📋 Backup JSON adicional: ${path.basename(jsonBackupDir)}/`);
    console.log(`📜 Script de restauración: ${path.basename(restoreScriptPath)}`);
    console.log(`📖 Instrucciones: ${path.basename(readmePath)}`);
    console.log('═══════════════════════════════════════════════');
    console.log('\n🔄 Para restaurar este backup:');
    console.log(`   bash ${restoreScriptPath}`);
    console.log('\n✅ ¡Backup listo! Ahora puedes proceder con las modificaciones.');
    
    return backupSummary;

  } catch (error) {
    console.error('\n❌ ERROR DURANTE EL BACKUP:');
    console.error(error.message);
    console.error('\n🆘 El backup no se completó correctamente.');
    console.error('   Verifica la configuración de la base de datos antes de continuar.');
    throw error;
  }
}

// Ejecutar backup si se llama directamente
if (require.main === module) {
  createFullBackup()
    .then((summary) => {
      console.log('\n✅ Proceso de backup finalizado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Proceso de backup falló:', error.message);
      process.exit(1);
    });
}

module.exports = { createFullBackup };
