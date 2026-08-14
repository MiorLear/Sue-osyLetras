package com.explorarte.api.community;

import java.io.Serializable;
import java.util.Objects;

public class PostLikeId implements Serializable {
    private Long postId;
    private String userId;

    public PostLikeId() {}

    public PostLikeId(Long postId, String userId) {
        this.postId = postId;
        this.userId = userId;
    }

    public Long getPostId() { return postId; }
    public void setPostId(Long postId) { this.postId = postId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PostLikeId that)) return false;
        return Objects.equals(postId, that.postId) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(postId, userId);
    }
}
