package com.explorarte.api.learning;

import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.explorarte.api.media.MediaItem;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "topic_subtopics")
public class SubTopic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "topic_id")
    private Topic topic;

    private String title;
    private String body;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<MediaItem> pdfs;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<MediaItem> videos;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<MediaItem> audios;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Topic getTopic() { return topic; }
    public void setTopic(Topic topic) { this.topic = topic; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public List<MediaItem> getPdfs() { return pdfs; }
    public void setPdfs(List<MediaItem> pdfs) { this.pdfs = pdfs; }

    public List<MediaItem> getVideos() { return videos; }
    public void setVideos(List<MediaItem> videos) { this.videos = videos; }

    public List<MediaItem> getAudios() { return audios; }
    public void setAudios(List<MediaItem> audios) { this.audios = audios; }

    public SubTopicDto toDto() {
        return new SubTopicDto(title, body, pdfs, videos, audios);
    }
}
