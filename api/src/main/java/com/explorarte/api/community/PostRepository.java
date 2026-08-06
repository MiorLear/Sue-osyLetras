package com.explorarte.api.community;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** Ordering lives in the Pageable rather than in the method name, so the feed's
 * sort is defined in exactly one place (PostController.FEED_SORT) and the
 * index in V4__pagination_indexes.sql can be matched to it. */
public interface PostRepository extends JpaRepository<Post, Long> {
    Page<Post> findByModule(String module, Pageable pageable);
}
