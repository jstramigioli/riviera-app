-- Índices para consultas frecuentes sin índice (solo agrega índices; no toca datos).
-- Disponibilidad y Libro filtran tramos por habitación + rango y por reserva;
-- el perfil de cliente lista reservas por titular; la caja lista cobros por fecha.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_mainClientId_idx" ON "Reservation"("mainClientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationSegment_roomId_startDate_endDate_idx" ON "ReservationSegment"("roomId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReservationSegment_reservationId_idx" ON "ReservationSegment"("reservationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cobro_fecha_idx" ON "Cobro"("fecha");
