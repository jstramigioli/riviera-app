import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ClientList from '../components/ClientList';
import ClientStats from '../components/ClientStats';
import styles from '../styles/Estadisticas.module.css';

function Estadisticas() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // 'list' o 'stats'

  useEffect(() => {
    loadClients();
  }, [])

  const loadClients = async () => {
    try {
      setLoading(true);
      const clientsData = await api.fetchClients();
      setClients(clientsData);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      setError('Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleClientUpdated = (updatedClient) => {
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === updatedClient.id ? updatedClient : client
      )
    );
  };

  const handleClientDeleted = (clientId) => {
    setClients(prevClients => 
      prevClients.filter(c => c.id !== clientId)
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Cargando clientes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>❌ {error}</p>
          <button onClick={loadClients} className={styles.retryButton}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const clientsWithPromotions = clients.filter(c => c.wantsPromotions).length;
  const argentineClients = clients.filter(c => c.country === 'AR').length;
  const clientsWithAddress = clients.filter(c => {
    if (!c.notes) return false;
    const addressMatch = c.notes.match(/Domicilio:\s*(.+)/);
    return addressMatch && addressMatch[1].trim();
  }).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📊 Estadísticas</h1>
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{clients.length}</span>
            <span className={styles.statLabel}>Total de Clientes</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{argentineClients}</span>
            <span className={styles.statLabel}>Clientes Argentinos</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{clientsWithPromotions}</span>
            <span className={styles.statLabel}>Quieren Promociones</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>
              {clients.filter(c => c.email).length}
            </span>
            <span className={styles.statLabel}>Con Email</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{clientsWithAddress}</span>
            <span className={styles.statLabel}>Con Domicilio</span>
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.sidebar}>
          <div className={styles.tabNavigation}>
            <button
              className={`${styles.tabButton} ${activeTab === 'list' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('list')}
            >
              📋 Listado de Clientes
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'stats' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              📊 Estadísticas de Clientes
            </button>
          </div>
        </div>

        <div className={styles.contentArea}>
          {activeTab === 'list' && (
            <ClientList
              clients={clients}
              onClientUpdated={handleClientUpdated}
              onClientDeleted={handleClientDeleted}
            />
          )}
          
          {activeTab === 'stats' && (
            <ClientStats clients={clients} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Estadisticas; 