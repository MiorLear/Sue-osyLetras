package com.explorarte.api.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.explorarte.api.media.MediaItem;
import com.explorarte.api.media.MediaUrlPolicy;

class ToolsContentMapperTest {

    private static final String OWN = "https://explorarte.app/media/tools/";
    private final MediaUrlPolicy policy = new MediaUrlPolicy("https://explorarte.app", "");

    private static MediaItem media(String url) {
        return new MediaItem("id-1", "libro.pdf", url, "application/pdf", 1);
    }

    private static ToolBook book(String id, MediaItem file, MediaItem cover) {
        return new ToolBook(id, "Libro " + id, null, file, cover, null);
    }

    @Test
    void derivesTheLegacyFieldsSoAnOldCachedPwaKeepsRendering() {
        ToolsContentDto dto = ToolsContentMapper.toDto(
                List.of(
                        new ToolShelf("a", "A", List.of(book("1", media(OWN + "1.pdf"), null))),
                        new ToolShelf("b", "B", List.of(book("2", media(OWN + "2.pdf"), null)))),
                List.of(
                        new BibliographyEntry("x", "Emocionario", "Cristina Núñez", null, null),
                        new BibliographyEntry("y", "Sin autor", " ", null, null)));

        assertThat(dto.downloadables()).extracting(MediaItem::url).containsExactly(OWN + "1.pdf", OWN + "2.pdf");
        assertThat(dto.bibliography()).containsExactly("Emocionario — Cristina Núñez", "Sin autor");
        assertThat(dto.manualDocument()).isNull();
        assertThat(dto.activityGuides()).isEmpty();
    }

    @Test
    void toleratesARowWrittenBeforeTheLibraryExisted() {
        ToolsContentDto dto = ToolsContentMapper.toDto(null, null);
        assertThat(dto.shelves()).isEmpty();
        assertThat(dto.bibliography()).isEmpty();
    }

    @Test
    void acceptsOwnStorageFilesAndAnExternalBookPage() {
        ToolsUpdateInput input = new ToolsUpdateInput(
                List.of(new ToolShelf("a", "A", List.of(book("1", media(OWN + "1.pdf"), media(OWN + "c.jpg"))))),
                List.of(new BibliographyEntry("x", "Libro", null, media(OWN + "i.jpg"), "https://www.editorial.com/libro")));

        assertThatCode(() -> ToolsContentMapper.checkUrls(input, policy)).doesNotThrowAnyException();
    }

    @Test
    void rejectsAFileOrCoverOutsideOurStorage() {
        ToolsUpdateInput foreignFile = new ToolsUpdateInput(
                List.of(new ToolShelf("a", "A", List.of(book("1", media("https://evil.example/x.pdf"), null)))),
                List.of());
        ToolsUpdateInput foreignCover = new ToolsUpdateInput(
                List.of(new ToolShelf("a", "A", List.of(book("1", media(OWN + "1.pdf"), media("https://evil.example/c.jpg"))))),
                List.of());

        assertThatThrownBy(() -> ToolsContentMapper.checkUrls(foreignFile, policy)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ToolsContentMapper.checkUrls(foreignCover, policy)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theBookPageLinkMustBeHttp() {
        for (String bad : List.of("javascript:alert(1)", "data:text/html,hola", "ftp://x.org/libro", "https://user:pw@x.org", "not a url")) {
            ToolsUpdateInput input = new ToolsUpdateInput(
                    List.of(), List.of(new BibliographyEntry("x", "Libro", null, null, bad)));
            assertThatThrownBy(() -> ToolsContentMapper.checkUrls(input, policy))
                    .as(bad)
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
