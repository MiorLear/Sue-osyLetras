package com.explorarte.api.auth;

public record ResetPasswordInput(String emailOrPhone, String code, String newPassword) {}
