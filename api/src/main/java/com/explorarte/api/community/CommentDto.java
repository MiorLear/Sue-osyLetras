package com.explorarte.api.community;

public record CommentDto(Long id, String user, String initials, String avatarBg, String time, String text) {}
