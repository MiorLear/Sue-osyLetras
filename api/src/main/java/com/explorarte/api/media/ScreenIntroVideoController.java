package com.explorarte.api.media;

import java.util.List;
import java.util.NoSuchElementException;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ScreenIntroVideoController {

    private final ScreenIntroVideoRepository repository;

    public ScreenIntroVideoController(ScreenIntroVideoRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/screen-intro-videos")
    public List<ScreenIntroVideoDto> list() {
        return repository.findAll().stream().map(ScreenIntroVideo::toDto).toList();
    }

    @GetMapping("/screen-intro-videos/{screenKey}")
    public ScreenIntroVideoDto get(@PathVariable String screenKey) {
        return repository.findById(screenKey)
                .orElseThrow(() -> new NoSuchElementException("No intro video for screen: " + screenKey))
                .toDto();
    }

    @PutMapping("/screen-intro-videos/{screenKey}")
    public ScreenIntroVideoDto update(@PathVariable String screenKey, @RequestBody MediaItem video) {
        ScreenIntroVideo entity = repository.findById(screenKey).orElseGet(() -> {
            ScreenIntroVideo v = new ScreenIntroVideo();
            v.setScreenKey(screenKey);
            return v;
        });
        entity.setVideo(video);
        repository.save(entity);
        return entity.toDto();
    }
}
