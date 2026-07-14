package com.explorarte.api.tools;

import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

import com.explorarte.api.media.MediaItem;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

@Entity
@Table(name = "tools_content")
public class ToolsContentEntity implements Persistable<Short> {

    public static final short SINGLETON_ID = 1;

    @Id
    private Short id = SINGLETON_ID;

    @Transient
    private boolean isNew = true;

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }

    @JdbcTypeCode(SqlTypes.JSON)
    private List<MediaItem> downloadables;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> bibliography;

    @Column(name = "manual_document")
    @JdbcTypeCode(SqlTypes.JSON)
    private MediaItem manualDocument;

    @Column(name = "activity_guides")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<MediaItem> activityGuides;

    @Override
    public Short getId() { return id; }
    public void setId(Short id) { this.id = id; }

    public List<MediaItem> getDownloadables() { return downloadables; }
    public void setDownloadables(List<MediaItem> downloadables) { this.downloadables = downloadables; }

    public List<String> getBibliography() { return bibliography; }
    public void setBibliography(List<String> bibliography) { this.bibliography = bibliography; }

    public MediaItem getManualDocument() { return manualDocument; }
    public void setManualDocument(MediaItem manualDocument) { this.manualDocument = manualDocument; }

    public List<MediaItem> getActivityGuides() { return activityGuides; }
    public void setActivityGuides(List<MediaItem> activityGuides) { this.activityGuides = activityGuides; }

    public ToolsContentDto toDto() {
        return new ToolsContentDto(downloadables, bibliography, manualDocument, activityGuides);
    }
}
