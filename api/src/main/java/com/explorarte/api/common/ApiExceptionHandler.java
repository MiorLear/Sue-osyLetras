package com.explorarte.api.common;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.NoSuchElementException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import jakarta.validation.ConstraintViolationException;

/**
 * Single place where an exception becomes an HTTP response (SEC-20).
 *
 * <p>Extending {@link ResponseEntityExceptionHandler} means the framework's own
 * failures (unreadable body, wrong parameter type, unsupported method) come back
 * as RFC 7807 {@link ProblemDetail} bodies instead of bare 500s, and the domain
 * handlers below use the same shape — every error carries a {@code detail}
 * string, which is what the existing clients already read.
 *
 * <p>Two rules for the messages: never echo caller-supplied identifiers back
 * (they were the source of the {@code NoSuchElementException} id reflection),
 * and never surface an internal exception message. Unexpected failures are
 * logged server-side and answered generically.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    // --- Bean Validation ---------------------------------------------------

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail body = problem(HttpStatus.BAD_REQUEST, "The request body is not valid");
        Map<String, String> errors = new LinkedHashMap<>();
        for (var error : ex.getBindingResult().getAllErrors()) {
            String field = error instanceof FieldError fieldError ? fieldError.getField() : error.getObjectName();
            errors.putIfAbsent(field, error.getDefaultMessage());
        }
        body.setProperty("errors", errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /** Constraints on @PathVariable / @RequestParam are validated by the
     * framework itself since Spring 6.1 and land here. */
    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(
            HandlerMethodValidationException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail body = problem(HttpStatus.BAD_REQUEST, "One or more request parameters are not valid");
        Map<String, String> errors = new LinkedHashMap<>();
        for (ParameterValidationResult result : ex.getAllValidationResults()) {
            String name = result.getMethodParameter().getParameterName();
            result.getResolvableErrors().stream().findFirst().ifPresent(
                    error -> errors.putIfAbsent(name == null ? "request" : name, error.getDefaultMessage()));
        }
        body.setProperty("errors", errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ProblemDetail> handleConstraintViolation(ConstraintViolationException ex) {
        ProblemDetail body = problem(HttpStatus.BAD_REQUEST, "One or more request parameters are not valid");
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getConstraintViolations()
                .forEach(v -> errors.putIfAbsent(String.valueOf(v.getPropertyPath()), v.getMessage()));
        body.setProperty("errors", errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // --- Domain ------------------------------------------------------------

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ProblemDetail> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem(HttpStatus.NOT_FOUND, ex.getMessage()));
    }

    /** Kept for the controllers that still raise the JDK exception. Its message
     * historically embedded the caller-supplied id, so it is deliberately not
     * echoed here. */
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ProblemDetail> handleNotFound(NoSuchElementException ex) {
        log.debug("Resource not found", ex);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem(HttpStatus.NOT_FOUND, "Resource not found"));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ProblemDetail> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem(HttpStatus.CONFLICT, ex.getMessage()));
    }

    /** Backstop for a unique/foreign-key violation that slipped past the
     * application-level pre-check: a 409, never a 500 echoing the SQL. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(problem(HttpStatus.CONFLICT, "The request conflicts with existing data"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProblemDetail> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedByPolicyException.class)
    public ResponseEntity<ProblemDetail> handleForbidden(AccessDeniedByPolicyException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem(HttpStatus.FORBIDDEN, ex.getMessage()));
    }

    // --- Uploads -----------------------------------------------------------

    @ExceptionHandler(UnsupportedMediaTypeException.class)
    public ResponseEntity<ProblemDetail> handleUnsupportedMediaType(UnsupportedMediaTypeException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(problem(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ex.getMessage()));
    }

    @ExceptionHandler(PayloadTooLargeException.class)
    public ResponseEntity<ProblemDetail> handlePayloadTooLarge(PayloadTooLargeException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(problem(HttpStatus.PAYLOAD_TOO_LARGE, ex.getMessage()));
    }

    /**
     * The container rejects the part before any controller code runs once the
     * multipart limit in application.yml is hit; without this it is a bare 500.
     *
     * <p>Tiene que ser este override y no un {@code @ExceptionHandler} propio.
     * {@link ResponseEntityExceptionHandler} ya declara
     * {@code MaxUploadSizeExceededException} entre las excepciones que atiende,
     * así que un segundo método anotado para el mismo tipo deja dos candidatos
     * empatados: Spring responde "Ambiguous @ExceptionHandler method mapped" al
     * construir {@code handlerExceptionResolver} y <b>el contexto no levanta</b>.
     * Lo detectó GCP-07 corriendo la imagen de producción; ApplicationStartsTest
     * lo cubre desde ahora.
     */
    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(problem(HttpStatus.PAYLOAD_TOO_LARGE, "The uploaded file is too large"));
    }

    /** GCP-04: an unconfigured or unreachable media bucket is an environment
     * problem, so it answers 503 (the client may retry) rather than a 500 that
     * looks like a bug in the request. The underlying message is logged, never
     * returned — a Cloud Storage error string names the bucket and the service
     * account. */
    @ExceptionHandler(StorageUnavailableException.class)
    public ResponseEntity<ProblemDetail> handleStorageUnavailable(StorageUnavailableException ex) {
        log.error("Media storage is unavailable", ex);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(problem(HttpStatus.SERVICE_UNAVAILABLE, "File storage is not available right now"));
    }

    private static ProblemDetail problem(HttpStatus status, String detail) {
        return ProblemDetail.forStatusAndDetail(status, detail == null ? status.getReasonPhrase() : detail);
    }
}
