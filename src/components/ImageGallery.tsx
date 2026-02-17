import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageGalleryProps {
  images: string[];
  alt?: string;
}

const ImageGallery = ({ images, alt = "Image" }: ImageGalleryProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Auto-slideshow: runs every 1.5s unless hovered or lightbox open
  useEffect(() => {
    if (isHovered || lightboxOpen || images.length <= 1) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(goNext, 1500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHovered, lightboxOpen, goNext, images.length]);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, goNext, goPrev]);

  if (images.length === 0) {
    return (
      <div className="h-full min-h-[300px] rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
        No images
      </div>
    );
  }

  return (
    <>
      {/* Main slideshow */}
      <div
        className="relative h-full overflow-hidden rounded-xl bg-muted cursor-pointer group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setLightboxOpen(true)}
      >
        {images.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`${alt} ${i + 1}`}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
              i === activeIndex ? "opacity-100" : "opacity-0"
            )}
          />
        ))}

        {/* Dots indicator */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === activeIndex ? "w-6 bg-white" : "w-2 bg-white/50"
                )}
              />
            ))}
          </div>
        )}

        {/* Hover arrows */}
        {images.length > 1 && isHovered && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow hover:bg-background transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow hover:bg-background transition"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <X className="h-6 w-6" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}

          <img
            src={images[activeIndex]}
            alt={`${alt} ${activeIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {activeIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
};

export default ImageGallery;
