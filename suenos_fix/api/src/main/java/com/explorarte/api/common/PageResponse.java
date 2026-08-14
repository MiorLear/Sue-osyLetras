package com.explorarte.api.common;

import java.util.List;

import org.springframework.data.domain.Page;

/**
 * Envelope returned by a list endpoint when the caller asks for a page.
 *
 * <p>Deliberately not Spring Data's own {@code Page} serialization, which is
 * unstable across versions and leaks {@code Pageable}/{@code Sort} internals
 * into the contract.
 *
 * @param items    the page's contents, already mapped to their DTOs
 * @param page     zero-based page index
 * @param size     page size actually applied after clamping
 * @param total    total matching rows
 * @param pages    total number of pages
 * @param hasMore  whether another page follows this one
 */
public record PageResponse<T>(List<T> items, int page, int size, long total, int pages, boolean hasMore) {

    /** Builds the envelope from the source page plus its already-mapped items,
     * since the DTO type is rarely the entity type. */
    public static <T> PageResponse<T> of(Page<?> source, List<T> items) {
        return new PageResponse<>(
                items,
                source.getNumber(),
                source.getSize(),
                source.getTotalElements(),
                source.getTotalPages(),
                source.hasNext());
    }
}
