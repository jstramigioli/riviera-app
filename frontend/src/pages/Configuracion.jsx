import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import HabitacionesTab from '../components/configuracion/HabitacionesTab';
import CargosTarifasTab from '../components/configuracion/CargosTarifasTab';
import MenuConsumosTab from '../components/configuracion/MenuConsumosTab';
import HotelConfigPanel from '../components/configuracion/HotelConfigPanel';
import CalendarioTab from '../components/configuracion/CalendarioTab';
import TipoCambioConfig from '../components/TipoCambioConfig';
import MediosPagoTab from '../components/configuracion/MediosPagoTab';
import PromocionesTab from '../components/configuracion/PromocionesTab';
import Auditoria from './Auditoria';
import { useAuth } from '../contexts/AuthContext';
import styles from './Configuracion.module.css';

const SETTINGS_TABS = [
  { id: 'hotel', label: 'Hotel' },
  { id: 'habitaciones', label: 'Habitaciones' },
  { id: 'cargos-tarifas', label: 'Cargos y Tarifas' },
  { id: 'menu-consumos', label: 'Menú' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'tipo-cambio', label: 'Tipo de Cambio' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'sistema', label: 'Sistema' }
];

const MEDIOS_PAGO_TAB = { id: 'medios-pago', label: 'Medios de pago' };
const PROMOCIONES_TAB = { id: 'promociones', label: 'Promociones' };
const AUDITORIA_TAB = { id: 'auditoria', label: 'Auditoría' };

function ConfiguracionView() {
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const canSettings = can('settings');
  const canMediosPago = can('mediosPago');
  const canPromociones = can('promociones');
  const canAuditoria = can('auditoria');

  const tabs = useMemo(() => {
    const next = [];
    if (canSettings) next.push(...SETTINGS_TABS);
    if (canMediosPago) next.push(MEDIOS_PAGO_TAB);
    if (canPromociones) next.push(PROMOCIONES_TAB);
    if (canAuditoria) next.push(AUDITORIA_TAB);
    return next;
  }, [canSettings, canMediosPago, canPromociones, canAuditoria]);

  const validTabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const defaultTab = canSettings
    ? 'habitaciones'
    : canMediosPago
      ? 'medios-pago'
      : canAuditoria
        ? 'auditoria'
        : 'habitaciones';

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
      case 'menu-consumos':
        return <MenuConsumosTab />;
      case 'calendario':
        return <CalendarioTab />;
      case 'tipo-cambio':
        return <TipoCambioConfig />;
      case 'medios-pago':
        return <MediosPagoTab />;
      case 'promociones':
        return <PromocionesTab />;
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
        if (canSettings) return <HabitacionesTab />;
        if (canMediosPago) return <MediosPagoTab />;
        return <Auditoria />;
    }
  };

  return (
    <div className={styles.newLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Configuración</h2>
        </div>
        <nav className={styles.sectionMenu} aria-label="Secciones de configuración">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`${styles.sectionButton} ${activeTab === tab.id ? styles.active : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>
          <section className={styles.section}>
            <div className={styles.panel}>{renderTabContent()}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ConfiguracionView;
