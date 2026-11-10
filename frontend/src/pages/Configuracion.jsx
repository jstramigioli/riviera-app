import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiHome, FiGrid, FiDollarSign, FiCalendar, FiRefreshCw, FiUsers, FiSettings } from 'react-icons/fi';
import HabitacionesTab from '../components/configuracion/HabitacionesTab';
import CargosTarifasTab from '../components/configuracion/CargosTarifasTab';
import HotelConfigPanel from '../components/configuracion/HotelConfigPanel';
import CalendarioTab from '../components/configuracion/CalendarioTab';
import TipoCambioConfig from '../components/TipoCambioConfig';
import styles from './Configuracion.module.css';

const VALID_TABS = new Set([
  'hotel',
  'habitaciones',
  'cargos-tarifas',
  'calendario',
  'tipo-cambio',
  'usuarios',
  'sistema'
]);

function ConfiguracionView() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && VALID_TABS.has(fromUrl)) return fromUrl;
    return localStorage.getItem('configActiveTab') || 'habitaciones';
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_TABS.has(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('configActiveTab', activeTab);
  }, [activeTab]);

  const tabs = [
    { id: 'hotel', label: 'Hotel', icon: FiHome },
    { id: 'habitaciones', label: 'Habitaciones', icon: FiGrid },
    { id: 'cargos-tarifas', label: 'Cargos y Tarifas', icon: FiDollarSign },
    { id: 'calendario', label: 'Calendario', icon: FiCalendar },
    { id: 'tipo-cambio', label: 'Tipo de Cambio', icon: FiRefreshCw },
    { id: 'usuarios', label: 'Usuarios', icon: FiUsers },
    { id: 'sistema', label: 'Sistema', icon: FiSettings }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hotel':
        return <HotelConfigPanel />;
      case 'habitaciones':
        return <HabitacionesTab />;
      case 'cargos-tarifas':
        return <CargosTarifasTab />;
      case 'calendario':
        return <CalendarioTab />;
      case 'tipo-cambio':
        return <TipoCambioConfig />;
      case 'usuarios':
        return (
          <div className={styles.placeholder}>
            <h3>Gestión de Usuarios</h3>
            <p>Esta funcionalidad estará disponible próximamente.</p>
          </div>
        );
      case 'sistema':
        return (
          <div className={styles.placeholder}>
            <h3>Configuración del Sistema</h3>
            <p>Esta funcionalidad estará disponible próximamente.</p>
          </div>
        );
      default:
        return <HabitacionesTab />;
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Configuración</h1>
        <nav className={styles.tabs} aria-label="Secciones de configuración">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            >
              <span className={styles.tabIcon} aria-hidden="true"><tab.icon /></span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className={styles.content}>
        <div className={styles.panel}>{renderTabContent()}</div>
      </div>
    </div>
  );
}

export default ConfiguracionView;
