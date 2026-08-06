package com.explorarte.api.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/**
 * Shared paging rules for the list endpoints (SCALE-01).
 *
 * <p>The list endpoints used to return whole tables. Rather than break the two
 * deployed clients at once, pagination is opt-in: a request that names
 * {@code page} or {@code size} gets a {@link PageResponse} envelope, and a
 * request that names neither still gets a bare JSON array — but a bounded one,
 * capped at {@link #LEGACY_CAP} rows, so no caller can pull an unbounded table
 * any more.
 */
public final class Pagination {

    /** Page size applied when the caller asks for a page but not a size. */
    public static final int DEFAULT_SIZE = 20;

    /** Ceiling on an explicitly requested page size. */
    public static final int MAX_SIZE = 100;

    /** Ceiling on the legacy, un-paginated array response. Generous enough not
     * to truncate any realistic current data set, small enough to bound the
     * query and the offline cache that stores whatever it is handed. */
    public static final int LEGACY_CAP = 200;

    private Pagination() {
    }

    /** True when the caller opted in to the paginated response shape. */
    public static boolean isRequested(Integer page, Integer size) {
        return page != null || size != null;
    }

    /**
     * Clamps caller input into a safe {@link PageRequest}. Out-of-range values
     * are clamped rather than rejected so that a client walking off the end of
     * a feed gets an empty page instead of a 400.
     */
    public static PageRequest of(Integer page, Integer size, Sort sort) {
        if (!isRequested(page, size)) {
            return PageRequest.of(0, LEGACY_CAP, sort);
        }
        int index = page == null || page < 0 ? 0 : page;
        int pageSize = size == null ? DEFAULT_SIZE : Math.clamp(size, 1, MAX_SIZE);
        return PageRequest.of(index, pageSize, sort);
    }
}
