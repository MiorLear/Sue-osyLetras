package com.explorarte.api.community;

import org.springframework.data.domain.Persistable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.IdClass;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

@Entity
@Table(name = "post_likes")
@IdClass(PostLikeId.class)
public class PostLike implements Persistable<PostLikeId> {

    @Id
    @Column(name = "post_id")
    private Long postId;

    @Id
    @Column(name = "user_id")
    private String userId;

    @Transient
    private boolean isNew = true;

    public PostLike() {}

    public PostLike(Long postId, String userId) {
        this.postId = postId;
        this.userId = userId;
    }

    @Override
    public PostLikeId getId() { return new PostLikeId(postId, userId); }

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }

    public Long getPostId() { return postId; }
    public void setPostId(Long postId) { this.postId = postId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}
