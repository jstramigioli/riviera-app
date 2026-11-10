import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiHome, FiGrid, FiDollarSign, FiCalendar, FiRefreshCw, FiUsers, FiSettings, FiClipboard } from 'react-icons/fi';
import HabitacionesTab from '../components/configuracion/HabitacionesTab';
import CargosTarifasTab from '../components/configuracion/CargosTarifasTab';
import HotelConfigPanel from '../components/configuracion/HotelConfigPanel';
import CalendarioTab from '../components/configuracion/CalendarioTab';
import TipoCambioConfig from '../components/TipoCambioConfig';
import Auditoria from './Auditoria';
import { useAuth } from '../contexts/AuthContext';
import styles from './Configuracion.module.css';

const SETTINGS_TABS = [
  { id: 'hotel', label: 'Hotel', icon: FiHome },
  { id: 'habitaciones', label: 'Habitaciones', icon: FiGrid },
  { id: 'cargos-tarifas', label: 'Cargos y Tarifas', icon: FiDollarSign },
  { id: 'calendario', label: 'Calendario', icon: FiCalendar },
  { id: 'tipo-cambio', label: 'Tipo de Cambio', icon: FiRefreshCw },
  { id: 'usuarios', label: 'Usuarios', icon: FiUsers },
  { id: 'sistema', label: 'Sistema', icon: FiSettings }
];

const AUDITORIA_TAB = { id: 'auditoria', label: 'Auditoría', icon: FiClipboard };

function ConfiguracionView() {
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const canSettings = can('settings');
  const canAuditoria = can('auditoria');

  const tabs = useMemo(() => {
    const next = [];
    if (canSettings) next.push(...SETTINGS_TABS);
    if (canAuditoria) next.push(AUDITORIA_TAB);
    return next;
  }, [canSettings, canAuditoria]);

  const validTabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const defaultTab = canSettings ? 'habitaciones' : (canAuditoria ? 'auditoria' : 'habitaciones');

  const [activeTab, setActiveTab] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && validTabIds.has(fromUrl)) return fromUrl;
    const stored = localStorage.getItem('configActiveTab');
    if (stored && validTabIds.has(stored)) return stored;
    return defaultTab;
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && validTabIds.has(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, validTabIds]);

  useEffect(() => {
    if (!validTabIds.has(activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs, validTabIds]);

  useEffect(() => {
    localStorage.setItem('configActiveTab', activeTab);
  }, [activeTab]);

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
      case 'auditoria':
        return <Auditoria />;
      default:
        return canSettings ? <HabitacionesTab /> : <Auditoria />;
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
