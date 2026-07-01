package com.explorarte.api.learning;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Persistable;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

// Implements Persistable so Spring Data calls persist() (not merge()) for new
// entities — our @Id is a manually-assigned slug, not @GeneratedValue, so
// Spring Data's default "is this new?" check (id == null) would otherwise
// always say "no" and route every save() through merge(), which mishandles
// the @OrderColumn-managed subtopics collection on first insert.
@Entity
@Table(name = "topics")
public class Topic implements Persistable<String> {

    @Id
    private String id;

    private String emoji;
    private String title;

    @Transient
    private boolean isNew = true;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "topic_id")
    @OrderColumn(name = "position")
    private List<SubTopic> subtopics = new ArrayList<>();

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }

    @Override
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public List<SubTopic> getSubtopics() { return subtopics; }
    public void setSubtopics(List<SubTopic> subtopics) { this.subtopics = subtopics; }

    public TopicDto toDto() {
        return new TopicDto(id, emoji, title, subtopics.stream().map(SubTopic::toDto).toList());
    }
}
