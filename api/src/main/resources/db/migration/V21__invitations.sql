-- Invitaciones por correo emitidas desde la consola de administracion.
--
-- Se guarda el SHA-256 del token, nunca el token: el valor en claro solo existe
-- el tiempo que tarda en irse en el correo, asi que un volcado de esta tabla no
-- sirve para aceptar invitaciones ajenas.
CREATE TABLE invitations (
  id               VARCHAR(64) PRIMARY KEY,
  email            VARCHAR(254) NOT NULL,
  token_hash       VARCHAR(64) NOT NULL UNIQUE,
  status           VARCHAR(20) NOT NULL,
  invited_by       VARCHAR(64),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  accepted_at      TIMESTAMPTZ,
  accepted_user_id VARCHAR(64)
);

-- Se busca por correo al revocar las pendientes antes de emitir una nueva.
CREATE INDEX idx_invitations_email ON invitations (lower(email));
