-- SEC-05: persist the failed-guess counter for verification codes.
--
-- A 6-digit code with a 15-minute TTL, no attempt counter and no invalidation on
-- failure is brute-forceable to full account takeover. The counter lives in the
-- same row as the code so the lockout survives a restart and is shared by every
-- API instance, unlike an in-memory tally.
ALTER TABLE verification_codes
    ADD COLUMN attempts INT NOT NULL DEFAULT 0;
