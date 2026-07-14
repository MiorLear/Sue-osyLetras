package com.explorarte.api.community;

import java.util.List;

import com.explorarte.api.media.MediaItem;

public record CreatePostInput(String text, String module, List<MediaItem> attachments) {}
