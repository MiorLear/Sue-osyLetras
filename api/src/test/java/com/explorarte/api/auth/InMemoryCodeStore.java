package com.explorarte.api.auth;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;

/**
 * Map-backed stand-in for {@link VerificationCodeRepository}. Docker is not available in this
 * environment, so nothing in these tests may need Postgres — and mocking the interface keeps
 * it portable across JDKs.
 *
 * <p>{@code delete} is implemented, unlike a bare stub, because the lockout in
 * {@code VerificationCodeService} destroys the row and a test that silently ignored that
 * would be asserting the wrong thing.
 */
final class InMemoryCodeStore {

    final Map<String, VerificationCode> rows = new HashMap<>();

    VerificationCodeRepository asRepository() {
        VerificationCodeRepository repository = Mockito.mock(VerificationCodeRepository.class);
        Mockito.lenient().when(repository.findById(ArgumentMatchers.anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(rows.get(invocation.<String>getArgument(0))));
        Mockito.lenient().when(repository.save(ArgumentMatchers.any(VerificationCode.class)))
                .thenAnswer(invocation -> {
                    VerificationCode entity = invocation.getArgument(0);
                    rows.put(entity.getIdentifier(), entity);
                    return entity;
                });
        Mockito.lenient().doAnswer(invocation -> {
            rows.remove(invocation.<VerificationCode>getArgument(0).getIdentifier());
            return null;
        }).when(repository).delete(ArgumentMatchers.any(VerificationCode.class));
        return repository;
    }

    Optional<VerificationCode> find(String identifier) {
        return Optional.ofNullable(rows.get(identifier));
    }
}
