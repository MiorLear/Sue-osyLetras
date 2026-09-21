package com.explorarte.api.learning;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Una fase que una docente marcó como completada.
 *
 * <p>A diferencia del resto de entidades con id asignado a mano, esta
 * <b>no</b> implementa {@code Persistable}, y es deliberado: aquí
 * {@code merge()} es exactamente el comportamiento que queremos. "Marcar
 * completada" tiene que ser idempotente —el buzón de salida de la PWA reenvía
 * lo que no llegó a irse— y merge hace SELECT y luego INSERT o UPDATE según
 * encuentre, en vez de un INSERT que chocaría con la clave primaria.
 */
@Entity
@Table(name = "learning_progress")
@IdClass(LearningProgressId.class)
public class LearningProgress {

    @Id
    @Column(name = "user_id")
    private String userId;

    @Id
    @Column(name = "topic_id")
    private String topicId;

    @Id
    @Column(name = "subtopic_key")
    private String subtopicKey;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    public LearningProgress() {}

    public LearningProgress(String userId, String topicId, String subtopicKey) {
        this.userId = userId;
        this.topicId = topicId;
        this.subtopicKey = subtopicKey;
    }

    @PrePersist
    void stampCompletedAt() {
        if (completedAt == null) completedAt = Instant.now();
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTopicId() { return topicId; }
    public void setTopicId(String topicId) { this.topicId = topicId; }

    public String getSubtopicKey() { return subtopicKey; }
    public void setSubtopicKey(String subtopicKey) { this.subtopicKey = subtopicKey; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public LearningProgressDto toDto() {
        return new LearningProgressDto(topicId, subtopicKey, completedAt);
    }
}
