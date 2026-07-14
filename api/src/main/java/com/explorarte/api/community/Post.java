package com.explorarte.api.community;

import java.time.Instant;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.explorarte.api.media.MediaItem;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "author_user_id")
    private String authorUserId;

    @Column(name = "user_name")
    private String userName;

    private String handle;
    private boolean verified;

    @Column(name = "avatar_bg")
    private String avatarBg;

    private String module;
    private String text;

    @Column(name = "likes_count")
    private int likesCount;

    private int reposts;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @JdbcTypeCode(SqlTypes.JSON)
    private List<MediaItem> attachments;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getAuthorUserId() { return authorUserId; }
    public void setAuthorUserId(String authorUserId) { this.authorUserId = authorUserId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getHandle() { return handle; }
    public void setHandle(String handle) { this.handle = handle; }

    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }

    public String getAvatarBg() { return avatarBg; }
    public void setAvatarBg(String avatarBg) { this.avatarBg = avatarBg; }

    public String getModule() { return module; }
    public void setModule(String module) { this.module = module; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public int getLikesCount() { return likesCount; }
    public void setLikesCount(int likesCount) { this.likesCount = likesCount; }

    public int getReposts() { return reposts; }
    public void setReposts(int reposts) { this.reposts = reposts; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public List<MediaItem> getAttachments() { return attachments; }
    public void setAttachments(List<MediaItem> attachments) { this.attachments = attachments; }
}
