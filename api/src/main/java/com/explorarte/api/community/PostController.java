package com.explorarte.api.community;

import java.util.List;
import java.util.NoSuchElementException;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.common.RelativeTime;
import com.explorarte.api.security.CurrentUserService;
import com.explorarte.api.user.User;

@RestController
public class PostController {

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final PostLikeRepository postLikeRepository;
    private final CurrentUserService currentUserService;

    public PostController(
            PostRepository postRepository,
            CommentRepository commentRepository,
            PostLikeRepository postLikeRepository,
            CurrentUserService currentUserService) {
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.postLikeRepository = postLikeRepository;
        this.currentUserService = currentUserService;
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
    public PostDto create(@RequestBody CreatePostInput input) {
        User author = currentUserService.currentUser();
        Post post = new Post();
        post.setAuthorUserId(author.getId());
        post.setUserName(author.getName() + " " + author.getLastname());
        post.setHandle("@" + author.getName().toLowerCase().replaceAll("\\s+", "_"));
        post.setVerified(author.getRole() != null && author.getRole().name().equals("ADMIN"));
        post.setAvatarBg("#3DBFB8");
        post.setModule(input.module());
        post.setText(input.text());
        post.setAttachments(input.attachments());
        postRepository.save(post);
        return toDto(post, author.getId());
    }

    @PostMapping("/posts/{id}/like")
    public PostDto toggleLike(@PathVariable Long id) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Post not found: " + id));
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
    public CommentDto addComment(@PathVariable Long id, @RequestBody CreateCommentInput input) {
        if (!postRepository.existsById(id)) {
            throw new NoSuchElementException("Post not found: " + id);
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
