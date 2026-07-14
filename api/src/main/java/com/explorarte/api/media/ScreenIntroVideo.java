package com.explorarte.api.media;

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

    @JdbcTypeCode(SqlTypes.JSON)
    private MediaItem video;

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

    public ScreenIntroVideoDto toDto() {
        return new ScreenIntroVideoDto(screenKey, video);
    }
}
