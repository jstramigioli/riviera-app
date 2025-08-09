import React from 'react';
import styles from '../styles/Estadisticas.module.css';

function ClientStats({ clients }) {
  // Calcular estadísticas por provincia
  const provinceStats = clients
    .filter(client => client.province && client.province.trim() !== '')
    .reduce((acc, client) => {
      const province = client.province.trim();
      acc[province] = (acc[province] || 0) + 1;
      return acc;
    }, {});

  // Ordenar provincias por cantidad de clientes
  const sortedProvinces = Object.entries(provinceStats)
    .sort(([,a], [,b]) => b - a);

  // Tomar las 5 provincias más importantes y agrupar el resto en "Otros"
  const topProvinces = sortedProvinces.slice(0, 5);
  const otherProvinces = sortedProvinces.slice(5);
  const otherCount = otherProvinces.reduce((sum, [, count]) => sum + count, 0);

  const totalClientsWithProvince = clients.filter(c => c.province && c.province.trim() !== '').length;

  // Estadísticas adicionales
  const stats = {
    totalClients: clients.length,
    clientsWithProvince: totalClientsWithProvince,
    clientsWithoutProvince: clients.length - totalClientsWithProvince,
    argentineClients: clients.filter(c => c.country === 'AR').length,
    foreignClients: clients.filter(c => c.country && c.country !== 'AR').length,
    clientsWithEmail: clients.filter(c => c.email).length,
    clientsWithPhone: clients.filter(c => c.phone).length,
    clientsWithPromotions: clients.filter(c => c.wantsPromotions).length
  };

  return (
    <div className={styles.statsContainer}>
      <div className={styles.statsGrid}>
        <div className={styles.statSection}>
          <h3>📊 Resumen General</h3>
          <div className={styles.statsCards}>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{stats.totalClients}</span>
              <span className={styles.statLabel}>Total de Clientes</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{stats.argentineClients}</span>
              <span className={styles.statLabel}>Argentinos</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{stats.foreignClients}</span>
              <span className={styles.statLabel}>Extranjeros</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{stats.clientsWithEmail}</span>
              <span className={styles.statLabel}>Con Email</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{stats.clientsWithPhone}</span>
              <span className={styles.statLabel}>Con Teléfono</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{stats.clientsWithPromotions}</span>
              <span className={styles.statLabel}>Quieren Promociones</span>
            </div>
          </div>
        </div>

        <div className={styles.statSection}>
          <h3>🗺️ Distribución por Provincia</h3>
          <div className={styles.provinceStats}>
            <div className={styles.provinceChart}>
              {topProvinces.map(([province, count]) => {
                const percentage = ((count / totalClientsWithProvince) * 100).toFixed(1);
                return (
                  <div key={province} className={styles.provinceBar}>
                    <div className={styles.provinceInfo}>
                      <span className={styles.provinceName}>{province}</span>
                      <span className={styles.provinceCount}>{count} ({percentage}%)</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              
              {otherCount > 0 && (
                <div className={styles.provinceBar}>
                  <div className={styles.provinceInfo}>
                    <span className={styles.provinceName}>Otros</span>
                    <span className={styles.provinceCount}>
                      {otherCount} ({((otherCount / totalClientsWithProvince) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill}
                      style={{ width: `${((otherCount / totalClientsWithProvince) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className={styles.provinceSummary}>
              <p><strong>Total con provincia:</strong> {totalClientsWithProvince}</p>
              <p><strong>Sin provincia:</strong> {stats.clientsWithoutProvince}</p>
              <p><strong>Provincias únicas:</strong> {Object.keys(provinceStats).length}</p>
            </div>
          </div>
        </div>

        <div className={styles.statSection}>
          <h3>📋 Detalle por Provincia</h3>
          <div className={styles.provinceTable}>
            <table>
              <thead>
                <tr>
                  <th>Provincia</th>
                  <th>Cantidad</th>
                  <th>Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                {sortedProvinces.map(([province, count]) => {
                  const percentage = ((count / totalClientsWithProvince) * 100).toFixed(1);
                  return (
                    <tr key={province}>
                      <td>{province}</td>
                      <td>{count}</td>
                      <td>{percentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClientStats; 