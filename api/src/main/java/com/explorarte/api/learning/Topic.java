package com.explorarte.api.learning;

import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
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

    /**
     * Cómo se recorre el tema. Se guarda en MAYÚSCULAS porque
     * {@code EnumType.STRING} persiste el {@code name()}, no el
     * {@code @JsonValue}; el CHECK {@code topics_layout_known} de V12 valida
     * exactamente esos tres valores.
     */
    @Enumerated(EnumType.STRING)
    private TopicLayout layout = TopicLayout.ACCORDION;

    /** La introducción del tema, antes de sus subtemas. Puede venir vacía. */
    @JdbcTypeCode(SqlTypes.JSON)
    private List<LearningBlock> intro = new ArrayList<>();

    @Transient
    private boolean isNew = true;

    /**
     * Los subtemas, con {@code mappedBy} y no con {@code @JoinColumn}.
     *
     * <p>La diferencia no es cosmética. Con un {@code @OneToMany}
     * unidireccional sobre {@code @JoinColumn}, la colección era dueña de
     * {@code topic_id} y a la vez lo era el {@code @ManyToOne} de
     * {@link SubTopic}: dos mapeos sobre la misma columna. Con esa ambigüedad,
     * quitar un elemento de la colección no lo borraba, lo DESVINCULABA —
     * {@code update topic_subtopics set topic_id=null, position=null}— y como
     * la columna es NOT NULL, cada intento de editar o borrar un tema desde el
     * CMS terminaba en una violación de integridad. Crear funcionaba, que es
     * justo lo que hacía que el fallo pasara desapercibido.
     *
     * <p>Con {@code mappedBy} el dueño es el lado hijo, así que
     * {@code orphanRemoval} borra de verdad en vez de desvincular. Lo cubre
     * {@code LearningDeletionTest}.
     */
    @OneToMany(mappedBy = "topic", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderColumn(name = "position")
    // EAGER + findAll() son 1+N: una consulta por tema solo para sus subtemas.
    // @BatchSize los pide de diez en diez con un IN, asi que el listado del CMS
    // y el de Aprendiendo bajan de 1+N a dos consultas.
    //
    // Sigue siendo EAGER a proposito. Pasar a LAZY seria la solucion "de libro",
    // pero aqui rompe: application.yml tiene open-in-view: false, y
    // LearningController.create()/update() llaman a topic.toDto(), que recorre
    // subtopics YA FUERA de la transaccion. Con LAZY eso es un
    // LazyInitializationException en produccion, no un test en rojo.
    @BatchSize(size = 10)
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

    public TopicLayout getLayout() { return layout; }
    public void setLayout(TopicLayout layout) { this.layout = layout; }

    public List<LearningBlock> getIntro() { return intro; }
    public void setIntro(List<LearningBlock> intro) { this.intro = intro; }

    public List<SubTopic> getSubtopics() { return subtopics; }
    public void setSubtopics(List<SubTopic> subtopics) { this.subtopics = subtopics; }

    public TopicDto toDto() {
        return new TopicDto(id, emoji, title, layout, intro, subtopics.stream().map(SubTopic::toDto).toList());
    }
}
