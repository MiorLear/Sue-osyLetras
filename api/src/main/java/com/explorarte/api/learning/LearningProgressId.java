package com.explorarte.api.learning;

import java.io.Serializable;
import java.util.Objects;

/** La clave compuesta de {@link LearningProgress}. Mismo molde que PostLikeId. */
public class LearningProgressId implements Serializable {

    private String userId;
    private String topicId;
    private String subtopicKey;

    public LearningProgressId() {}

    public LearningProgressId(String userId, String topicId, String subtopicKey) {
        this.userId = userId;
        this.topicId = topicId;
        this.subtopicKey = subtopicKey;
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTopicId() { return topicId; }
    public void setTopicId(String topicId) { this.topicId = topicId; }

    public String getSubtopicKey() { return subtopicKey; }
    public void setSubtopicKey(String subtopicKey) { this.subtopicKey = subtopicKey; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof LearningProgressId that)) return false;
        return Objects.equals(userId, that.userId)
                && Objects.equals(topicId, that.topicId)
                && Objects.equals(subtopicKey, that.subtopicKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, topicId, subtopicKey);
    }
}
