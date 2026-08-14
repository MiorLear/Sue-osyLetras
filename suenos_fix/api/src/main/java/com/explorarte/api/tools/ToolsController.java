package com.explorarte.api.tools;

import java.util.NoSuchElementException;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ToolsController {

    private final ToolsContentRepository toolsContentRepository;

    public ToolsController(ToolsContentRepository toolsContentRepository) {
        this.toolsContentRepository = toolsContentRepository;
    }

    @GetMapping("/tools")
    public ToolsContentDto get() {
        return toolsContentRepository.findById(ToolsContentEntity.SINGLETON_ID)
                .orElseThrow(() -> new NoSuchElementException("Tools content not seeded"))
                .toDto();
    }

    @PutMapping("/tools")
    public ToolsContentDto update(@RequestBody ToolsContentDto input) {
        ToolsContentEntity entity = toolsContentRepository.findById(ToolsContentEntity.SINGLETON_ID)
                .orElseGet(ToolsContentEntity::new);
        entity.setDownloadables(input.downloadables());
        entity.setBibliography(input.bibliography());
        entity.setManualDocument(input.manualDocument());
        entity.setActivityGuides(input.activityGuides());
        toolsContentRepository.save(entity);
        return entity.toDto();
    }
}
