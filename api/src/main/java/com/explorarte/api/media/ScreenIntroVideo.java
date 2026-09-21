package com.explorarte.api.media;

import java.util.ArrayList;
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
@Table(name = "screen_intro_videos")
public class ScreenIntroVideo implements Persistable<String> {

    @Id
    @Column(name = "screen_key")
    private String screenKey;

    /** Puede no haberlo: una pantalla puede tener solo texto. */
    @JdbcTypeCode(SqlTypes.JSON)
    private MediaItem video;

    /** Los parrafos de introduccion, en orden. Vacio = no se dibuja la tarjeta. */
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> paragraphs = new ArrayList<>();

    @Transient
    private boolean isNew = true;

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }

    @Override
    public String getId() { return screenKey; }

    public String getScreenKey() { return screenKey; }
    public void setScreenKey(String screenKey) { this.screenKey = screenKey; }

    public MediaItem getVideo() { return video; }
    public void setVideo(MediaItem video) { this.video = video; }

    public List<String> getParagraphs() { return paragraphs; }
    public void setParagraphs(List<String> paragraphs) { this.paragraphs = paragraphs; }

    public ScreenIntroVideoDto toDto() {
        return new ScreenIntroVideoDto(screenKey, video, paragraphs == null ? List.of() : paragraphs);
    }
}
