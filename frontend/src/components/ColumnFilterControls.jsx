import styles from './ColumnFilter.module.css';

/** Controles para el menú de ColumnFilter: texto, rango de fechas, rango numérico y opciones. */

export function TextFilter({ label, value, onChange, placeholder = 'Buscar…' }) {
  return (
    <input
      type="search"
      className={styles.input}
      aria-label={`Filtrar ${label}`}
      placeholder={placeholder}
      autoFocus
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function DateRangeFilter({ label, value = {}, onChange }) {
  return (
    <div className={styles.stack}>
      <label className={styles.row}>
        <span className={styles.rowLabel}>Desde</span>
        <input
          type="date"
          className={styles.input}
          aria-label={`${label} desde`}
          value={value.from || ''}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </label>
      <label className={styles.row}>
        <span className={styles.rowLabel}>Hasta</span>
        <input
          type="date"
          className={styles.input}
          aria-label={`${label} hasta`}
          value={value.to || ''}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </label>
    </div>
  );
}

export function NumberRangeFilter({ label, value = {}, onChange }) {
  return (
    <div className={styles.stack}>
      <input
        type="number"
        className={styles.input}
        aria-label={`${label} mínimo`}
        placeholder="Mín"
        autoFocus
        value={value.min ?? ''}
        onChange={(e) => onChange({ ...value, min: e.target.value })}
      />
      <input
        type="number"
        className={styles.input}
        aria-label={`${label} máximo`}
        placeholder="Máx"
        value={value.max ?? ''}
        onChange={(e) => onChange({ ...value, max: e.target.value })}
      />
    </div>
  );
}

/** Casillas; ninguna marcada = todas. options: string[] o [{ value, label }]. */
export function OptionsFilter({ label, options, value = [], onChange }) {
  const selected = new Set(value);
  const toggle = (val) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange([...next]);
  };
  return (
    <div className={styles.stack} role="group" aria-label={label}>
      {options.length === 0 ? <span className={styles.empty}>Sin opciones</span> : null}
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const text = typeof opt === 'string' ? opt : opt.label;
        return (
          <label key={val} className={styles.check}>
            <input type="checkbox" checked={selected.has(val)} onChange={() => toggle(val)} />
            {text}
          </label>
        );
      })}
      {selected.size ? (
        <button type="button" className={styles.clear} onClick={() => onChange([])}>
          Quitar filtro
        </button>
      ) : null}
    </div>
  );
}
