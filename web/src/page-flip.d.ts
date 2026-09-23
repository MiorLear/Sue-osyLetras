// page-flip (StPageFlip) no publica tipos. Esto cubre solo lo que usa el lector.
declare module 'page-flip' {
  export interface PageFlipSettings {
    width: number;
    height: number;
    size?: 'fixed' | 'stretch';
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startPage?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    swipeDistance?: number;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
    useMouseEvents?: boolean;
  }

  export interface PageFlipEvent<T = unknown> {
    data: T;
    object: PageFlip;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: PageFlipSettings);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    on(event: 'flip', cb: (e: PageFlipEvent<number>) => void): PageFlip;
    on(event: 'changeOrientation', cb: (e: PageFlipEvent<'portrait' | 'landscape'>) => void): PageFlip;
    on(event: 'init' | 'update', cb: (e: PageFlipEvent<{ page: number; mode: string }>) => void): PageFlip;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getOrientation(): 'portrait' | 'landscape';
    destroy(): void;
  }
}
