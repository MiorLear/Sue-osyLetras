package com.explorarte.api.tools;

import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

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
    private List<String> downloadables;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> bibliography;

    @Override
    public Short getId() { return id; }
    public void setId(Short id) { this.id = id; }

    public List<String> getDownloadables() { return downloadables; }
    public void setDownloadables(List<String> downloadables) { this.downloadables = downloadables; }

    public List<String> getBibliography() { return bibliography; }
    public void setBibliography(List<String> bibliography) { this.bibliography = bibliography; }

    public ToolsContentDto toDto() {
        return new ToolsContentDto(downloadables, bibliography);
    }
}
