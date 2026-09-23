package com.explorarte.api.community;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostLikeRepository extends JpaRepository<PostLike, PostLikeId> {
    Optional<PostLike> findByPostIdAndUserId(Long postId, String userId);

    /**
     * De este lote de posts, cuales le gustan a esta usuaria: una consulta en
     * vez de una por post. Devuelve solo los ids, que es lo unico que el feed
     * necesita para pintar el corazon.
     *
     * No hace falta indice nuevo: post_likes tiene PRIMARY KEY (post_id,
     * user_id) desde V1__init_schema.sql, y Postgres crea su btree.
     */
    @Query("select l.postId from PostLike l where l.userId = :userId and l.postId in :postIds")
    List<Long> findLikedPostIds(@Param("userId") String userId, @Param("postIds") Collection<Long> postIds);
}
