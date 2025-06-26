import React from 'react';
import './SidePanel.css';

export default function SidePanel({ open, onClose, title, children, width = 400 }) {
  return (
    <>
      {/* Overlay */}
      <div 
        className={`sidepanel-overlay${open ? ' open' : ''}`} 
        onClick={onClose}
        style={{ display: open ? 'block' : 'none' }}
      />
      {/* Panel */}
      <aside 
        className={`sidepanel${open ? ' open' : ''}`}
        style={{ width, right: open ? 0 : -width }}
        aria-hidden={!open}
      >
        <div className="sidepanel-header">
          <h2>{title}</h2>
          <button className="sidepanel-close" onClick={onClose}>&times;</button>
        </div>
        <div className="sidepanel-content">
          {children}
        </div>
      </aside>
    </>
  );
} 