import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FiLogIn } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import logoHotel from '../assets/logo-hotel.png';
import styles from '../styles/Login.module.css';

function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    const redirectTo = location.state?.from || '/libro-de-reservas';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      const redirectTo = location.state?.from || '/libro-de-reservas';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <img src={logoHotel} alt="Hotel Riviera" className={styles.logo} />
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="username">
            Usuario
          </label>
          <input
            id="username"
            name="username"
            className={styles.input}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
            required
          />

          <label className={styles.label} htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className={styles.input}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
          />

          {error ? <p className={styles.error} role="alert">{error}</p> : null}

          <button type="submit" className={styles.submit} disabled={submitting}>
            <FiLogIn aria-hidden="true" />
            <span>{submitting ? 'Ingresando...' : 'Ingresar'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
