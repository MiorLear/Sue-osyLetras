package com.explorarte.api.community;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByPostIdOrderByCreatedAtAsc(Long postId);

    /**
     * Los comentarios de un lote de posts en una sola consulta. Sirve al feed,
     * que antes hacia una consulta por post: con el tope heredado de 200 filas
     * eso eran 200 idas a la base solo para los comentarios.
     *
     * El indice que lo respalda ya existe: idx_comments_post_id_created_at, de
     * V4__pagination_indexes.sql.
     */
    List<Comment> findByPostIdInOrderByPostIdAscCreatedAtAsc(Collection<Long> postIds);
}
