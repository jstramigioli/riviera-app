import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installApiFetchCredentials } from './services/http';
import './index.css';

installApiFetchCredentials();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
