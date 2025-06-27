import { useState } from 'react';
import { getClientBalance } from '../services/api.js';

export function useSidePanel() {
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientBalance, setClientBalance] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [panelMode, setPanelMode] = useState('reservation'); // 'reservation' o 'client'

  const handleReservationClick = (reservation) => {
    setSelectedReservation(reservation);
    setSelectedClient(null);
    setEditData(reservation);
    setIsEditing(false);
    setPanelMode('reservation');
    setSidePanelOpen(true);
  };

  const handleClientClick = async (client) => {
    setSelectedClient(client);
    setSelectedReservation(null);
    setEditData(client);
    setIsEditing(false);
    setPanelMode('client');
    setSidePanelOpen(true);
    
    // Cargar el balance del cliente
    try {
      const balance = await getClientBalance(client.id);
      setClientBalance(balance);
    } catch (error) {
      console.error('Error loading client balance:', error);
      setClientBalance(null);
    }
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditToggle = () => {
    setIsEditing(edit => !edit);
    if (panelMode === 'reservation') {
      setEditData(selectedReservation);
    } else {
      setEditData(selectedClient);
    }
  };

  const closePanel = () => {
    setSidePanelOpen(false);
    setSelectedReservation(null);
    setSelectedClient(null);
    setClientBalance(null);
    setIsEditing(false);
    setEditData(null);
  };

  return {
    sidePanelOpen,
    selectedReservation,
    selectedClient,
    clientBalance,
    isEditing,
    editData,
    panelMode,
    handleReservationClick,
    handleClientClick,
    handleEditChange,
    handleEditToggle,
    closePanel,
    setSidePanelOpen,
    setSelectedReservation,
    setSelectedClient,
    setClientBalance,
    setIsEditing,
    setEditData,
    setPanelMode
  };
} 