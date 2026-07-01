package com.explorarte.api.emotions;

import org.springframework.data.domain.Persistable;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

// Persistable: the @Id is a manually-assigned slug, not @GeneratedValue, so
// Spring Data needs an explicit isNew() to route new saves through persist()
// instead of merge().
@Entity
@Table(name = "emotions")
public class Emotion implements Persistable<String> {

    @Id
    private String id;
    private String name;
    private String emoji;
    private String color;
    private String bg;

    @Transient
    private boolean isNew = true;

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }

    @Override
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getBg() { return bg; }
    public void setBg(String bg) { this.bg = bg; }

    public EmotionDto toDto() {
        return new EmotionDto(id, name, emoji, color, bg);
    }
}
