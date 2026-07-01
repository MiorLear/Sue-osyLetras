package com.explorarte.api.community;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findByModuleOrderByCreatedAtDesc(String module);
    List<Post> findAllByOrderByCreatedAtDesc();
}
