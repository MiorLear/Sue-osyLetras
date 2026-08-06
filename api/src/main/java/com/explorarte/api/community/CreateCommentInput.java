package com.explorarte.api.community;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCommentInput(@NotBlank @Size(max = 2000) String text) {}
