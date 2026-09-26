package com.explorarte.api.invitation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface InvitationRepository extends JpaRepository<Invitation, String> {

    /** La busqueda que hace la pantalla publica: se conoce el hash, no el id. */
    Optional<Invitation> findByTokenHash(String tokenHash);

    List<Invitation> findByEmailIgnoreCaseAndStatus(String email, InvitationStatus status);

    List<Invitation> findAllByOrderByCreatedAtDesc();
}
