package com.explorarte.api.community;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.common.PageResponse;
import com.explorarte.api.common.Pagination;
import com.explorarte.api.common.RelativeTime;
import com.explorarte.api.common.ResourceNotFoundException;
import com.explorarte.api.media.MediaUrlPolicy;
import com.explorarte.api.security.CurrentUserService;
import com.explorarte.api.user.User;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
public class PostController {

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final PostLikeRepository postLikeRepository;
    private final CurrentUserService currentUserService;
    private final MediaUrlPolicy mediaUrlPolicy;

    public PostController(
            PostRepository postRepository,
            CommentRepository commentRepository,
            PostLikeRepository postLikeRepository,
            CurrentUserService currentUserService,
            MediaUrlPolicy mediaUrlPolicy) {
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.postLikeRepository = postLikeRepository;
        this.currentUserService = currentUserService;
        this.mediaUrlPolicy = mediaUrlPolicy;
    }

    /** Newest first, with the id as tie-breaker so a page boundary cannot drop
     * or duplicate a post when two share a timestamp. */
    private static final Sort FEED_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    /**
     * SCALE-01 — the feed used to return the whole {@code posts} table.
     *
     * <p>Response shape depends on the request: pass {@code page} and/or
     * {@code size} and the body is a {@link PageResponse} envelope; pass
     * neither and it stays the bare JSON array both deployed clients expect,
     * now capped at {@link Pagination#LEGACY_CAP} rows instead of unbounded.
     */
    @GetMapping("/posts")
    public Object list(
            @RequestParam(required = false) String emotion,
            @RequestParam(required = false) @Min(0) Integer page,
            @RequestParam(required = false) @Min(1) @Max(Pagination.MAX_SIZE) Integer size) {

        Pageable pageable = Pagination.of(page, size, FEED_SORT);
        Page<Post> posts = (emotion == null || emotion.isBlank() || emotion.equals("todos"))
                ? postRepository.findAll(pageable)
                : postRepository.findByModule(emotion, pageable);

        String userId = currentUserIdOrNull();
        List<PostDto> items = toDtos(posts.getContent(), userId);
        return Pagination.isRequested(page, size) ? PageResponse.of(posts, items) : items;
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public PostDto create(@Valid @RequestBody CreatePostInput input) {
        // SEC-15: attachment URLs are handed to Linking.openURL / <video src>
        // by the clients, so only URLs on our own storage origin are stored.
        mediaUrlPolicy.checkAttachments(input.attachments());

        User author = currentUserService.currentUser();
        Post post = new Post();
        post.setAuthorUserId(author.getId());
        // The denormalised columns are narrower than name + lastname combined
        // (user_name VARCHAR(160), handle VARCHAR(80)), so they are truncated
        // rather than left to fail as a 500 at insert time.
        post.setUserName(truncate(author.getName() + " " + author.getLastname(), 160));
        post.setHandle(truncate("@" + author.getName().toLowerCase().replaceAll("\\s+", "_"), 80));
        post.setVerified(author.getRole() != null && author.getRole().name().equals("ADMIN"));
        post.setAvatarBg("#3DBFB8");
        post.setModule(input.module());
        post.setText(input.text());
        post.setAttachments(input.attachments());
        postRepository.save(post);
        return toDto(post, author.getId());
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    @PostMapping("/posts/{id}/like")
    public PostDto toggleLike(@PathVariable Long id) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Post"));
        String userId = currentUserService.currentUserId();
        var existing = postLikeRepository.findByPostIdAndUserId(id, userId);
        if (existing.isPresent()) {
            postLikeRepository.delete(existing.get());
            post.setLikesCount(Math.max(0, post.getLikesCount() - 1));
        } else {
            postLikeRepository.save(new PostLike(id, userId));
            post.setLikesCount(post.getLikesCount() + 1);
        }
        postRepository.save(post);
        return toDto(post, userId);
    }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentDto addComment(@PathVariable Long id, @Valid @RequestBody CreateCommentInput input) {
        if (!postRepository.existsById(id)) {
            throw new ResourceNotFoundException("Post");
        }
        User author = currentUserService.currentUser();
        Comment comment = new Comment();
        comment.setPostId(id);
        comment.setUserName(author.getName() + " " + author.getLastname());
        comment.setInitials(initialsOf(author));
        comment.setAvatarBg("#3DBFB8");
        comment.setText(input.text());
        commentRepository.save(comment);
        return comment.toDto();
    }

    /**
     * Moderacion: solo ADMIN (lo exige SecurityConfig). Los "me gusta" y los
     * comentarios caen con el post por el ON DELETE CASCADE de V1.
     */
    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable Long id) {
        if (!postRepository.existsById(id)) {
            throw new ResourceNotFoundException("Post");
        }
        postRepository.deleteById(id);
    }

    /** Moderacion: solo ADMIN. El comentario tiene que ser de ese post. */
    @DeleteMapping("/posts/{postId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeComment(@PathVariable Long postId, @PathVariable Long commentId) {
        Comment comment = commentRepository.findById(commentId)
                .filter(c -> c.getPostId().equals(postId))
                .orElseThrow(() -> new ResourceNotFoundException("Comment"));
        commentRepository.delete(comment);
    }

    private String initialsOf(User user) {
        String first = user.getName() == null || user.getName().isBlank() ? "" : user.getName().substring(0, 1);
        String last = user.getLastname() == null || user.getLastname().isBlank() ? "" : user.getLastname().substring(0, 1);
        return (first + last).toUpperCase();
    }

    private String currentUserIdOrNull() {
        try {
            return currentUserService.currentUserId();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    /**
     * El feed entero con tres consultas, pasara lo que pase: una de posts, una
     * de comentarios y una de "me gusta".
     *
     * Antes se llamaba a {@link #toDto(Post, String)} dentro de un map, y cada
     * llamada hacia dos consultas mas. Sin paginar el tope son
     * {@link Pagination#LEGACY_CAP} filas, o sea hasta 401 consultas para
     * dibujar una pantalla. No se notaba con un pu&ntilde;ado de publicaciones; se
     * iba a notar, y cada vez mas, segun la comunidad creciera.
     */
    private List<PostDto> toDtos(List<Post> posts, String requestingUserId) {
        if (posts.isEmpty()) return List.of();

        List<Long> ids = posts.stream().map(Post::getId).toList();

        Map<Long, List<CommentDto>> commentsByPost = commentRepository
                .findByPostIdInOrderByPostIdAscCreatedAtAsc(ids).stream()
                .collect(Collectors.groupingBy(
                        Comment::getPostId,
                        Collectors.mapping(Comment::toDto, Collectors.toList())));

        Set<Long> liked = requestingUserId == null
                ? Set.of()
                : Set.copyOf(postLikeRepository.findLikedPostIds(requestingUserId, ids));

        return posts.stream()
                .map(post -> toDto(
                        post,
                        liked.contains(post.getId()),
                        commentsByPost.getOrDefault(post.getId(), List.of())))
                .toList();
    }

    /** Un solo post, para cuando acaba de crearse o de cambiar. */
    private PostDto toDto(Post post, String requestingUserId) {
        boolean liked = requestingUserId != null
                && postLikeRepository.findByPostIdAndUserId(post.getId(), requestingUserId).isPresent();
        List<CommentDto> comments = commentRepository.findByPostIdOrderByCreatedAtAsc(post.getId())
                .stream().map(Comment::toDto).toList();
        return toDto(post, liked, comments);
    }

    private PostDto toDto(Post post, boolean liked, List<CommentDto> comments) {
        return new PostDto(
                post.getId(), post.getUserName(), post.getHandle(), post.isVerified(),
                RelativeTime.from(post.getCreatedAt()), post.getAvatarBg(), post.getModule(), post.getText(),
                post.getLikesCount(), liked, post.getReposts(), comments, post.getAttachments());
    }
}
