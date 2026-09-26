-- Aviso de "completa tu perfil" en el primer ingreso.
--
-- DEFAULT true a proposito: las cuentas que ya existen no deben recibir el
-- aviso. Solo las altas que vienen de una invitacion nacen en false, porque
-- llegan sin foto y, con Google, tambien sin nombre real ni ubicacion.
ALTER TABLE users ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT true;
