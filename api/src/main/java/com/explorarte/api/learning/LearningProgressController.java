package com.explorarte.api.learning;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.common.ResourceNotFoundException;
import com.explorarte.api.security.CurrentUserService;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * El avance de la docente conectada por los temas de Aprendiendo.
 *
 * <p>Vive en {@code /learning/progress} y no colgado de
 * {@code /learning/topics/{id}/progress} a propósito: la regla de
 * {@code SecurityConfig} que abre {@code GET /learning/topics/**} a cualquiera
 * se tragaría la lectura del avance ajeno, y la que exige ADMIN para
 * {@code PUT /learning/topics/**} dejaría a las docentes sin poder marcar una
 * fase. Dos rutas hermanas, cero solapamiento.
 *
 * <p>El usuario nunca llega por parámetro: siempre sale de
 * {@link CurrentUserService}, así que no hay forma de leer ni escribir el
 * avance de otra persona.
 */
@RestController
public class LearningProgressController {

    private final LearningProgressRepository progressRepository;
    private final TopicRepository topicRepository;
    private final CurrentUserService currentUserService;

    public LearningProgressController(LearningProgressRepository progressRepository,
            TopicRepository topicRepository, CurrentUserService currentUserService) {
        this.progressRepository = progressRepository;
        this.topicRepository = topicRepository;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/learning/progress")
    public List<LearningProgressDto> list() {
        // Sin filtrar las claves huérfanas: si la administradora borra una fase,
        // su fila sigue aquí y la pantalla la ignora al cruzarla con las claves
        // que el tema tiene hoy. Si la fase vuelve con la misma clave, el avance
        // reaparece — que es lo que una docente esperaría.
        return progressRepository.findByUserIdOrderByTopicIdAscSubtopicKeyAsc(currentUserService.currentUserId())
                .stream().map(LearningProgress::toDto).toList();
    }

    /**
     * Marcar una fase. Idempotente: la PWA reenvía lo que se encoló sin
     * conexión, y marcar dos veces tiene que dar lo mismo que marcar una.
     */
    @PutMapping("/learning/progress/{topicId}/{stepKey}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void complete(@PathVariable @NotBlank @Size(max = 64) String topicId,
            @PathVariable @NotBlank @Size(max = 64) String stepKey) {
        requireKnownPhase(topicId, stepKey);
        String userId = currentUserService.currentUserId();
        LearningProgressId id = new LearningProgressId(userId, topicId, stepKey);
        if (!progressRepository.existsById(id)) {
            progressRepository.save(new LearningProgress(userId, topicId, stepKey));
        }
    }

    /** Desmarcar. También idempotente: borrar lo que no está no es un error. */
    @DeleteMapping("/learning/progress/{topicId}/{stepKey}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void uncomplete(@PathVariable @NotBlank @Size(max = 64) String topicId,
            @PathVariable @NotBlank @Size(max = 64) String stepKey) {
        progressRepository.deleteByUserIdAndTopicIdAndSubtopicKey(
                currentUserService.currentUserId(), topicId, stepKey);
    }

    /** Empezar un tema de cero. */
    @DeleteMapping("/learning/progress/{topicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@PathVariable @NotBlank @Size(max = 64) String topicId) {
        progressRepository.deleteByUserIdAndTopicId(currentUserService.currentUserId(), topicId);
    }

    /**
     * 404 si el tema no existe o la clave no es una de sus fases.
     *
     * <p>Sin esto, una errata del cliente crearía una fila que nadie volverá a
     * leer y que además contaría en el "3 de 5" de la pantalla. Solo se
     * comprueba al marcar: al desmarcar, borrar una fila que ya no corresponde
     * a ninguna fase es precisamente lo que hay que dejar hacer.
     *
     * <p>{@code Topic.subtopics} es EAGER, así que el findById ya trae las claves.
     */
    private void requireKnownPhase(String topicId, String stepKey) {
        Topic topic = topicRepository.findById(topicId)
                .orElseThrow(() -> new ResourceNotFoundException("Topic"));
        boolean known = topic.getSubtopics().stream().anyMatch(s -> stepKey.equals(s.getKey()));
        if (!known) throw new ResourceNotFoundException("Learning phase");
    }
}
