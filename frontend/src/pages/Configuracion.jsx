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
import UsuariosTab from '../components/configuracion/UsuariosTab';
import Auditoria from './Auditoria';
import { useAuth } from '../contexts/AuthContext';
import { CARGOS_SUBTABS, filterConfigNav, getEnabledConfigNav } from './configNav';
import styles from './Configuracion.module.css';

const CARGOS_SUB_IDS = new Set(CARGOS_SUBTABS.map((s) => s.id));

function readInitialCargosSub() {
  const fromUrl = new URLSearchParams(window.location.search).get('sub');
  if (fromUrl && CARGOS_SUB_IDS.has(fromUrl)) return fromUrl;
  const stored = localStorage.getItem('cargosTarifasActiveTab');
  if (stored && CARGOS_SUB_IDS.has(stored)) return stored;
  return 'alojamiento';
}

function ConfiguracionView() {
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const [navQuery, setNavQuery] = useState('');

  const enabledNav = useMemo(() => getEnabledConfigNav(can), [can]);
  const visibleNav = useMemo(
    () => filterConfigNav(enabledNav, navQuery),
    [enabledNav, navQuery]
  );

  const validTabIds = useMemo(() => new Set(enabledNav.map((tab) => tab.id)), [enabledNav]);
  const defaultTab = enabledNav[0]?.id || 'habitaciones';

  const [activeTab, setActiveTab] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && validTabIds.has(fromUrl)) return fromUrl;
    const stored = localStorage.getItem('configActiveTab');
    if (stored && validTabIds.has(stored)) return stored;
    return defaultTab;
  });

  const [cargosSubTab, setCargosSubTab] = useState(readInitialCargosSub);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && validTabIds.has(tab)) {
      setActiveTab(tab);
    }
    const sub = searchParams.get('sub');
    if (sub && CARGOS_SUB_IDS.has(sub)) {
      setCargosSubTab(sub);
    }
  }, [searchParams, validTabIds]);

  useEffect(() => {
    if (!validTabIds.has(activeTab) && enabledNav.length > 0) {
      setActiveTab(enabledNav[0].id);
    }
  }, [activeTab, enabledNav, validTabIds]);

  useEffect(() => {
    localStorage.setItem('configActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('cargosTarifasActiveTab', cargosSubTab);
  }, [cargosSubTab]);

  const selectSection = (sectionId, subId) => {
    setActiveTab(sectionId);
    if (sectionId === 'cargos-tarifas' && subId && CARGOS_SUB_IDS.has(subId)) {
      setCargosSubTab(subId);
    }
    if (navQuery.trim()) {
      setNavQuery('');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hotel':
        return <HotelConfigPanel />;
      case 'habitaciones':
        return <HabitacionesTab />;
      case 'cargos-tarifas':
        return (
          <CargosTarifasTab
            forcedSubTab={cargosSubTab}
            onSubTabChange={setCargosSubTab}
          />
        );
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
        return <UsuariosTab />;
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
        if (validTabIds.has('habitaciones')) return <HabitacionesTab />;
        if (validTabIds.has('promociones')) return <PromocionesTab />;
        if (validTabIds.has('medios-pago')) return <MediosPagoTab />;
        if (validTabIds.has('auditoria')) return <Auditoria />;
        return null;
    }
  };

  return (
    <div className={styles.newLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Configuración</h2>
          <label className={styles.navSearchLabel} htmlFor="config-nav-search">
            Buscar sección
          </label>
          <input
            id="config-nav-search"
            type="search"
            className={styles.navSearch}
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder="Buscar secciones…"
            autoComplete="off"
          />
        </div>
        <nav className={styles.sectionMenu} aria-label="Secciones de configuración">
          {visibleNav.length === 0 ? (
            <p className={styles.navEmpty}>Sin resultados</p>
          ) : (
            visibleNav.map((section) => {
              const children = Array.isArray(section.children) ? section.children : [];
              const showChildren = Boolean(navQuery.trim()) && children.length > 0;
              return (
                <div key={section.id} className={styles.navGroup}>
                  <button
                    type="button"
                    onClick={() => selectSection(section.id)}
                    className={`${styles.sectionButton} ${
                      activeTab === section.id && !showChildren ? styles.active : ''
                    } ${
                      activeTab === section.id && showChildren ? styles.sectionParentActive : ''
                    }`}
                  >
                    {section.label}
                  </button>
                  {showChildren
                    ? children.map((child) => {
                        const isCargosChild =
                          section.id === 'cargos-tarifas' && Boolean(child.subId);
                        const childActive =
                          activeTab === section.id &&
                          isCargosChild &&
                          cargosSubTab === child.subId;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => selectSection(section.id, child.subId)}
                            className={`${styles.subSectionButton} ${
                              childActive ? styles.active : ''
                            }`}
                          >
                            {child.label}
                          </button>
                        );
                      })
                    : null}
                </div>
              );
            })
          )}
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
