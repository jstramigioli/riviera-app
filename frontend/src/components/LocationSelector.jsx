import React, { useState, useEffect, useRef } from 'react';
import argLocalities from '../assets/arg-localities.json';
import styles from './LocationSelector.module.css';

const LocationSelector = ({ 
  country, 
  province, 
  city, 
  onCountryChange, 
  onProvinceChange, 
  onCityChange,
  required = false 
}) => {
  console.log('LocationSelector renderizado con:', { country, province, city });
  
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [isArgentina, setIsArgentina] = useState(false);
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [filteredCities, setFilteredCities] = useState([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [selectedCityIndex, setSelectedCityIndex] = useState(-1);
  const cityInputRef = useRef(null);
  const cityDropdownRef = useRef(null);

  // Inicializar isArgentina basándose en el valor de country
  useEffect(() => {
    setIsArgentina(country === 'AR');
  }, [country]);

  // Sincronizar el término de búsqueda con el valor de city del formulario
  useEffect(() => {
    setCitySearchTerm(city || '');
  }, [city]);

  // Lista de países (puedes expandir según necesites)
  const countries = [
    { code: 'AR', name: 'Argentina' },
    { code: 'BR', name: 'Brasil' },
    { code: 'CL', name: 'Chile' },
    { code: 'PY', name: 'Paraguay' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'BO', name: 'Bolivia' },
    { code: 'PE', name: 'Perú' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'CO', name: 'Colombia' },
    { code: 'VE', name: 'Venezuela' },
    { code: 'GY', name: 'Guyana' },
    { code: 'SR', name: 'Surinam' },
    { code: 'GF', name: 'Guayana Francesa' },
    { code: 'MX', name: 'México' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'BZ', name: 'Belice' },
    { code: 'SV', name: 'El Salvador' },
    { code: 'HN', name: 'Honduras' },
    { code: 'NI', name: 'Nicaragua' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'PA', name: 'Panamá' },
    { code: 'CU', name: 'Cuba' },
    { code: 'JM', name: 'Jamaica' },
    { code: 'HT', name: 'Haití' },
    { code: 'DO', name: 'República Dominicana' },
    { code: 'PR', name: 'Puerto Rico' },
    { code: 'US', name: 'Estados Unidos' },
    { code: 'CA', name: 'Canadá' },
    { code: 'ES', name: 'España' },
    { code: 'IT', name: 'Italia' },
    { code: 'FR', name: 'Francia' },
    { code: 'DE', name: 'Alemania' },
    { code: 'GB', name: 'Reino Unido' },
    { code: 'PT', name: 'Portugal' },
    { code: 'OTHER', name: 'Otro' }
  ];

  // Cargar provincias cuando se selecciona Argentina
  useEffect(() => {
    if (isArgentina) {
      // Extraer provincias únicas del JSON
      const argentinaProvinces = argLocalities.map(prov => ({
        code: prov.province,
        name: prov.province
      })).sort((a, b) => a.name.localeCompare(b.name));
      setProvinces(argentinaProvinces);
      console.log('Provincias cargadas:', argentinaProvinces.length);
    } else {
      setProvinces([]);
      setCities([]);
    }
  }, [isArgentina]);

  // Cargar ciudades cuando se selecciona una provincia
  useEffect(() => {
    if (isArgentina && province) {
      const selectedProvinceData = argLocalities.find(prov => prov.province === province);
      if (selectedProvinceData) {
        // Eliminar duplicados usando un Map para mantener solo la primera ocurrencia
        const uniqueCitiesMap = new Map();
        selectedProvinceData.localities.forEach(loc => {
          if (!uniqueCitiesMap.has(loc.name)) {
            uniqueCitiesMap.set(loc.name, {
              code: loc.name, // Usar el nombre como código único
              name: loc.name
            });
          }
        });
        
        const provinceCities = Array.from(uniqueCitiesMap.values())
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setCities(provinceCities);
        console.log('Ciudades únicas cargadas para', province, ':', provinceCities.length);
      }
    } else {
      setCities([]);
    }
  }, [isArgentina, province]);

  // Filtrar ciudades cuando cambia el término de búsqueda
  useEffect(() => {
    if (citySearchTerm.trim() === '') {
      setFilteredCities([]);
      setShowCityDropdown(false);
      setSelectedCityIndex(-1);
    } else {
      const searchTerm = citySearchTerm.toLowerCase().trim();
      const filtered = cities
        .filter(city => city.name.toLowerCase().includes(searchTerm))
        .sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          
          // Priorizar coincidencias que empiecen con el término de búsqueda
          const aStartsWith = aName.startsWith(searchTerm);
          const bStartsWith = bName.startsWith(searchTerm);
          
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          
          // Si ambos empiezan o no empiezan, ordenar alfabéticamente
          return aName.localeCompare(bName);
        })
        .slice(0, 10); // Limitar a 10 resultados
      
      setFilteredCities(filtered);
      setShowCityDropdown(filtered.length > 0);
      setSelectedCityIndex(-1);
    }
  }, [citySearchTerm, cities]);

  // Manejar clics fuera del dropdown para cerrarlo
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target) &&
          cityInputRef.current && !cityInputRef.current.contains(event.target)) {
        setShowCityDropdown(false);
        setSelectedCityIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Manejar cambio de país
  const handleCountryChange = (e) => {
    const selectedCountry = e.target.value;
    onCountryChange(selectedCountry);
    
    if (selectedCountry === 'AR') {
      setIsArgentina(true);
    } else {
      setIsArgentina(false);
      onProvinceChange('');
      onCityChange('');
      setCitySearchTerm('');
    }
  };

  // Manejar cambio de provincia
  const handleProvinceChange = (e) => {
    const selectedProvince = e.target.value;
    onProvinceChange(selectedProvince);
    onCityChange(''); // Resetear ciudad cuando cambia provincia
    setCitySearchTerm('');
  };

  // Manejar cambio en el input de ciudad
  const handleCityInputChange = (e) => {
    const value = e.target.value;
    setCitySearchTerm(value);
    // Solo actualizar el formulario si es una ciudad válida o está vacío
    if (value === '' || cities.some(city => city.name === value)) {
      onCityChange(value);
    }
  };

  // Manejar selección de ciudad del dropdown
  const handleCitySelect = (selectedCity) => {
    setCitySearchTerm(selectedCity.name);
    onCityChange(selectedCity.name);
    setShowCityDropdown(false);
    setSelectedCityIndex(-1);
  };

  // Manejar navegación con teclado
  const handleCityKeyDown = (e) => {
    if (!isArgentina || !showCityDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedCityIndex(prev => 
          prev < filteredCities.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedCityIndex(prev => 
          prev > 0 ? prev - 1 : filteredCities.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedCityIndex >= 0 && selectedCityIndex < filteredCities.length) {
          handleCitySelect(filteredCities[selectedCityIndex]);
        }
        break;
      case 'Escape':
        setShowCityDropdown(false);
        setSelectedCityIndex(-1);
        break;
    }
  };

  // Validar que la ciudad ingresada sea válida
  const isCityValid = () => {
    if (!isArgentina || !citySearchTerm.trim()) return true;
    return cities.some(city => city.name === citySearchTerm);
  };

  return (
    <div className={styles.locationSelector}>
      {/* Selector de País */}
      <div className={styles.fieldGroup}>
        <label htmlFor="country" className={styles.label}>
          País {required && <span className={styles.required}>*</span>}
        </label>
        <select
          id="country"
          value={country}
          onChange={handleCountryChange}
          className={styles.select}
          required={required}
        >
          <option value="">Seleccionar país</option>
          {countries.map(countryOption => (
            <option key={countryOption.code} value={countryOption.code}>
              {countryOption.name}
            </option>
          ))}
        </select>
      </div>

      {/* Selector de Provincia */}
      <div className={styles.fieldGroup}>
        <label htmlFor="province" className={styles.label}>
          Provincia {required && isArgentina && <span className={styles.required}>*</span>}
        </label>
        {isArgentina ? (
          <select
            id="province"
            value={province}
            onChange={handleProvinceChange}
            className={styles.select}
            required={required}
          >
            <option value="">Seleccionar provincia</option>
            {provinces.map(provinceOption => (
              <option key={provinceOption.code} value={provinceOption.code}>
                {provinceOption.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            id="province"
            value={province}
            onChange={(e) => onProvinceChange(e.target.value)}
            placeholder="Solo disponible para Argentina"
            className={`${styles.input} ${styles.disabled}`}
            disabled={true}
          />
        )}
      </div>

      {/* Selector de Ciudad */}
      <div className={styles.fieldGroup}>
        <label htmlFor="city" className={styles.label}>
          Ciudad {required && isArgentina && <span className={styles.required}>*</span>}
        </label>
        <div className={styles.cityInputContainer}>
          <input
            type="text"
            id="city"
            ref={cityInputRef}
            value={citySearchTerm}
            onChange={handleCityInputChange}
            onKeyDown={handleCityKeyDown}
            placeholder={isArgentina ? "Buscar localidad..." : "Solo disponible para Argentina"}
            className={`${styles.input} ${!isArgentina ? styles.disabled : ''} ${!isCityValid() ? styles.invalid : ''}`}
            disabled={!isArgentina}
            required={required && isArgentina}
            onFocus={() => {
              if (isArgentina && citySearchTerm.trim() !== '' && filteredCities.length > 0) {
                setShowCityDropdown(true);
              }
            }}
          />
          
          {/* Dropdown de ciudades */}
          {showCityDropdown && isArgentina && (
            <div ref={cityDropdownRef} className={styles.cityDropdown}>
              {filteredCities.map((cityOption, index) => (
                <div
                  key={cityOption.code}
                  className={`${styles.cityOption} ${index === selectedCityIndex ? styles.selected : ''}`}
                  onClick={() => handleCitySelect(cityOption)}
                >
                  {cityOption.name}
                </div>
              ))}
            </div>
          )}
        </div>
        {!isCityValid() && citySearchTerm.trim() && (
          <div className={styles.errorMessage}>
            ⚠️ Por favor selecciona una ciudad válida de la lista
          </div>
        )}
      </div>

      {/* Información adicional */}
      {isArgentina && (
        <div className={styles.info}>
          <small>
            💡 Escribe en el campo ciudad para buscar localidades disponibles. Usa las flechas ↑↓ para navegar y Enter para seleccionar.
          </small>
        </div>
      )}
    </div>
  );
};

export default LocationSelector; 