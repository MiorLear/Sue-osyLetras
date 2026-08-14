package com.explorarte.api.community;

import java.util.List;

import com.explorarte.api.media.MediaItem;

public record PostDto(
        Long id,
        String user,
        String handle,
        boolean verified,
        String time,
        String avatarBg,
        String module,
        String text,
        int likes,
        boolean liked,
        int reposts,
        List<CommentDto> comments,
        List<MediaItem> attachments
) {}
