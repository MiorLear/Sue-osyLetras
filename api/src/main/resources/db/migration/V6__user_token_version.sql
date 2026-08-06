-- SEC-09: a revocation handle for already-issued tokens.
--
-- The JWT filter used to trust the token's `role` claim and never load the user, so a
-- demoted, rejected or deleted account kept full privileges for up to 24 hours and there
-- was no way to cut a session short — no logout, no jti, no version.
--
-- Every token now carries the `tv` claim; a token whose `tv` no longer matches this column
-- is refused. Bumping the column (logout, password reset) invalidates every token that
-- account is holding, everywhere, immediately.
ALTER TABLE users
    ADD COLUMN token_version INT NOT NULL DEFAULT 0;
