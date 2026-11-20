import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'

function LegacyTarifasRedirectRoutes() {
  return (
    <Routes>
      <Route path="/tarifas" element={<Navigate to="/configuracion?tab=cargos-tarifas" replace />} />
      <Route path="/tarifas/calendario" element={<Navigate to="/configuracion?tab=cargos-tarifas" replace />} />
      <Route path="/precios-inteligentes" element={<Navigate to="/configuracion?tab=cargos-tarifas" replace />} />
      <Route path="/configuracion" element={<div>Configuración cargos-tarifas</div>} />
    </Routes>
  )
}

describe('legacy Tarifas / Precios inteligentes redirects', () => {
  it.each([
    '/tarifas',
    '/tarifas/calendario',
    '/precios-inteligentes',
  ])('redirects %s to Configuración → Cargos y Tarifas', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <LegacyTarifasRedirectRoutes />
      </MemoryRouter>
    )

    expect(screen.getByText('Configuración cargos-tarifas')).toBeInTheDocument()
  })
})
