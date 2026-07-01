package com.explorarte.api.emotions;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EmotionRepository extends JpaRepository<Emotion, String> {}
