package com.explorarte.api.learning;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface LearningProgressRepository extends JpaRepository<LearningProgress, LearningProgressId> {

    List<LearningProgress> findByUserIdOrderByTopicIdAscSubtopicKeyAsc(String userId);

    /**
     * {@code @Transactional} explicito: un derived delete NO lo es por defecto
     * —a diferencia de {@code deleteById}, que lo hereda de
     * {@code SimpleJpaRepository}— y sin el es una TransactionRequiredException
     * en tiempo de ejecucion, no de compilacion.
     */
    @Transactional
    void deleteByUserIdAndTopicId(String userId, String topicId);

    @Transactional
    void deleteByUserIdAndTopicIdAndSubtopicKey(String userId, String topicId, String subtopicKey);
}
