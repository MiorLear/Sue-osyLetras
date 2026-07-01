package com.explorarte.api.emotions;

import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

@Entity
@Table(name = "emotion_content")
public class EmotionContent implements Persistable<String> {

    @Id
    @Column(name = "emotion_id")
    private String emotionId;

    private String description;
    private String classroom;

    @Transient
    private boolean isNew = true;

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }

    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> questions;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> activities;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> stories;

    @Override
    public String getId() { return emotionId; }

    public String getEmotionId() { return emotionId; }
    public void setEmotionId(String emotionId) { this.emotionId = emotionId; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getClassroom() { return classroom; }
    public void setClassroom(String classroom) { this.classroom = classroom; }

    public List<String> getQuestions() { return questions; }
    public void setQuestions(List<String> questions) { this.questions = questions; }

    public List<String> getActivities() { return activities; }
    public void setActivities(List<String> activities) { this.activities = activities; }

    public List<String> getStories() { return stories; }
    public void setStories(List<String> stories) { this.stories = stories; }

    public EmotionContentDto toDto() {
        return new EmotionContentDto(description, classroom, questions, activities, stories);
    }
}
