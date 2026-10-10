"use client";
import { useState, useRef, useEffect } from "react";
import { imageUrl, imageSet } from "@/lib/artwork";
export function Artwork({
  path,
  url,
  title,
  backdrop = false,
  eager = false,
  className = "",
}: {
  path?: string | null;
  url?: string | null;
  title: string;
  backdrop?: boolean;
  eager?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null),
    src = imageUrl(path, backdrop ? "w1280" : "w500") || url;
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (src && img.current?.complete && img.current.naturalWidth === 0)
      setFailedSrc(src);
  }, [src]);
  return (
    <div
      className={`artwork ${backdrop ? "landscape" : "portrait"} ${className}`}
    >
      {src && failedSrc !== src ? (
        <img
          ref={img}
          src={src}
          srcSet={imageSet(path, backdrop)}
          sizes={
            backdrop
              ? "100vw"
              : "(max-width: 600px) 45vw, (max-width: 1200px) 25vw, 20vw"
          }
          alt={backdrop ? "" : `${title} poster`}
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div className="art-fallback">
          <span className="fallback-mark">M / W</span>
          <span>{title}</span>
          <small>YOUR PRIVATE COLLECTION</small>
        </div>
      )}
    </div>
  );
}
