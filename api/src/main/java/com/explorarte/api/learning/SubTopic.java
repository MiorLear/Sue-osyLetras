package com.explorarte.api.learning;

import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.explorarte.api.media.MediaItem;

import jakarta.persistence.Column;
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

    /**
     * Clave estable del subtema dentro de su tema, y lo único a lo que el
     * avance de una docente puede apuntar.
     *
     * <p>Ni la posición ni este mismo {@code id} servirían: el PUT del CMS hace
     * {@code clear()} + {@code addAll()} sobre la colección, así que cada
     * guardado borra estas filas y crea otras nuevas con id distinto, y la
     * posición además se reordena. La clave viaja de ida y vuelta con el CMS y
     * sobrevive a las dos cosas.
     *
     * <p>La genera {@link LearningController} a partir del título la primera
     * vez, y no la regenera al renombrar.
     */
    @Column(name = "subtopic_key", nullable = false, length = 64)
    private String key;

    /** Emoji del nodo en el mapa de fases. Vacío en los layouts que no lo usan. */
    private String emoji;

    private String title;

    /**
     * El contenido. Sustituye a la columna {@code body}, que era un TEXT suelto
     * y por eso no podía representar listas, cuadros ni preguntas.
     *
     * <p>{@code body} sigue existiendo en la tabla, obsoleta y nullable, hasta
     * que no quede ninguna revisión desplegada que la lea: durante el rollout
     * de Cloud Run conviven la vieja y la nueva. Hibernate no se queja de una
     * columna que la entidad no mapea.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    private List<LearningBlock> blocks;

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

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public List<LearningBlock> getBlocks() { return blocks; }
    public void setBlocks(List<LearningBlock> blocks) { this.blocks = blocks; }

    public List<MediaItem> getPdfs() { return pdfs; }
    public void setPdfs(List<MediaItem> pdfs) { this.pdfs = pdfs; }

    public List<MediaItem> getVideos() { return videos; }
    public void setVideos(List<MediaItem> videos) { this.videos = videos; }

    public List<MediaItem> getAudios() { return audios; }
    public void setAudios(List<MediaItem> audios) { this.audios = audios; }

    public SubTopicDto toDto() {
        return new SubTopicDto(key, emoji == null ? "" : emoji, title, blocks, pdfs, videos, audios);
    }
}
