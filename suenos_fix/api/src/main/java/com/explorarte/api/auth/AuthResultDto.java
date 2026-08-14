package com.explorarte.api.auth;

import com.explorarte.api.user.UserProfileDto;

public record AuthResultDto(String token, UserProfileDto user) {}
