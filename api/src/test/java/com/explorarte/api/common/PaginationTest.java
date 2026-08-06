package com.explorarte.api.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

class PaginationTest {

    private static final Sort SORT = Sort.by(Sort.Order.desc("createdAt"));

    /** SCALE-01's compatibility choice: no paging params means the old bare
     * array, but the query behind it is bounded now. */
    @Test
    void withoutParamsFallsBackToTheBoundedLegacyPage() {
        assertThat(Pagination.isRequested(null, null)).isFalse();
        PageRequest request = Pagination.of(null, null, SORT);
        assertThat(request.getPageNumber()).isZero();
        assertThat(request.getPageSize()).isEqualTo(Pagination.LEGACY_CAP);
    }

    @Test
    void eitherParamOptsIntoPagination() {
        assertThat(Pagination.isRequested(0, null)).isTrue();
        assertThat(Pagination.isRequested(null, 10)).isTrue();
        assertThat(Pagination.of(null, 10, SORT).getPageSize()).isEqualTo(10);
        assertThat(Pagination.of(2, null, SORT).getPageSize()).isEqualTo(Pagination.DEFAULT_SIZE);
        assertThat(Pagination.of(2, null, SORT).getPageNumber()).isEqualTo(2);
    }

    @Test
    void clampsRatherThanRejectsOutOfRangeInput() {
        assertThat(Pagination.of(-5, 10, SORT).getPageNumber()).isZero();
        assertThat(Pagination.of(0, 5000, SORT).getPageSize()).isEqualTo(Pagination.MAX_SIZE);
        assertThat(Pagination.of(0, 0, SORT).getPageSize()).isEqualTo(1);
    }

    @Test
    void envelopeReportsWhetherMorePagesFollow() {
        var source = new PageImpl<>(List.of("a", "b"), PageRequest.of(0, 2, SORT), 5);
        PageResponse<String> response = PageResponse.of(source, List.of("A", "B"));

        assertThat(response.items()).containsExactly("A", "B");
        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(2);
        assertThat(response.total()).isEqualTo(5);
        assertThat(response.pages()).isEqualTo(3);
        assertThat(response.hasMore()).isTrue();

        var last = new PageImpl<>(List.of("e"), PageRequest.of(2, 2, SORT), 5);
        assertThat(PageResponse.of(last, List.of("E")).hasMore()).isFalse();
    }
}
