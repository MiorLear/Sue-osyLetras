package com.explorarte.api.tools;

import java.util.NoSuchElementException;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.media.MediaUrlPolicy;

import jakarta.validation.Valid;

@RestController
public class ToolsController {

    private final ToolsContentRepository toolsContentRepository;
    private final MediaUrlPolicy mediaUrlPolicy;

    public ToolsController(ToolsContentRepository toolsContentRepository, MediaUrlPolicy mediaUrlPolicy) {
        this.toolsContentRepository = toolsContentRepository;
        this.mediaUrlPolicy = mediaUrlPolicy;
    }

    @GetMapping("/tools")
    public ToolsContentDto get() {
        return toolsContentRepository.findById(ToolsContentEntity.SINGLETON_ID)
                .orElseThrow(() -> new NoSuchElementException("Tools content not seeded"))
                .toDto();
    }

    @PutMapping("/tools")
    public ToolsContentDto update(@Valid @RequestBody ToolsUpdateInput input) {
        // Los libros y las portadas se abren con <img src>, pdf.js y openFile:
        // solo se guardan URLs de nuestro almacenamiento (como SEC-15 en posts).
        ToolsContentMapper.checkUrls(input, mediaUrlPolicy);

        ToolsContentEntity entity = toolsContentRepository.findById(ToolsContentEntity.SINGLETON_ID)
                .orElseGet(ToolsContentEntity::new);
        entity.setShelves(input.shelves());
        entity.setBibliographyItems(input.bibliographyItems());
        toolsContentRepository.save(entity);
        return entity.toDto();
    }
}
