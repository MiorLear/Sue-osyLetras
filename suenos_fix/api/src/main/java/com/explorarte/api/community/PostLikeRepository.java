package com.explorarte.api.community;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PostLikeRepository extends JpaRepository<PostLike, PostLikeId> {
    Optional<PostLike> findByPostIdAndUserId(Long postId, String userId);
}
