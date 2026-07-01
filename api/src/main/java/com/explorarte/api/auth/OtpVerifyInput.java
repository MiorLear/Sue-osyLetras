package com.explorarte.api.auth;

public record OtpVerifyInput(String phone, String code) {}
