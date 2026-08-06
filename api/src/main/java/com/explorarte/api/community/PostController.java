package com.explorarte.api.community;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.common.RelativeTime;
import com.explorarte.api.common.ResourceNotFoundException;
import com.explorarte.api.media.MediaUrlPolicy;
import com.explorarte.api.security.CurrentUserService;
import com.explorarte.api.user.User;

import jakarta.validation.Valid;

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

    @GetMapping("/posts")
    public List<PostDto> list(@RequestParam(required = false) String emotion) {
        List<Post> posts = (emotion == null || emotion.isBlank() || emotion.equals("todos"))
                ? postRepository.findAllByOrderByCreatedAtDesc()
                : postRepository.findByModuleOrderByCreatedAtDesc(emotion);
        String userId = currentUserIdOrNull();
        return posts.stream().map(p -> toDto(p, userId)).toList();
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

    private PostDto toDto(Post post, String requestingUserId) {
        boolean liked = requestingUserId != null
                && postLikeRepository.findByPostIdAndUserId(post.getId(), requestingUserId).isPresent();
        List<CommentDto> comments = commentRepository.findByPostIdOrderByCreatedAtAsc(post.getId())
                .stream().map(Comment::toDto).toList();
        return new PostDto(
                post.getId(), post.getUserName(), post.getHandle(), post.isVerified(),
                RelativeTime.from(post.getCreatedAt()), post.getAvatarBg(), post.getModule(), post.getText(),
                post.getLikesCount(), liked, post.getReposts(), comments, post.getAttachments());
    }
}
