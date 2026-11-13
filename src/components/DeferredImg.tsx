"use client";

import { useState } from "react";
import { useAfterFirstPaint } from "@/lib/useAfterFirstPaint";
import type { SizedImage } from "@/lib/sized-image";

/**
 * A below-the-fold photo that queues behind the page's first paint.
 *
 * Native `loading="lazy"` is not enough on the landing page: Chrome starts a
 * lazy image up to 1250 px below the viewport (2500 px on a slow connection),
 * which covers the species strip and the farm tiles on a phone, so all twenty
 * began downloading alongside the hero. Until the first frame is on screen the
 * `<img>` holds a transparent pixel; after it, the real source goes in and the
 * browser's own lazy loading takes over.
 *
 * If the sized source fails (the image optimizer is unreachable or over its
 * free allowance), it falls back once to the original URL, so a tile is never
 * left broken for the sake of being small.
 */

/** 1x1 transparent GIF. An `<img>` with no `src` shows its alt text instead. */
const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

type Props = {
  image: SizedImage;
  alt: string;
  className?: string;
  /** The `sizes` hint that goes with `image.srcSet`. */
  sizes?: string;
};

export function DeferredImg({ image, alt, className, sizes }: Props) {
  const painted = useAfterFirstPaint();
  const [failed, setFailed] = useState(false);

  if (!painted) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={BLANK} alt={alt} loading="lazy" decoding="async" className={className} />;
  }

  if (failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image.fallbackSrc} alt={alt} loading="lazy" decoding="async" className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={image.srcSet ? sizes : undefined}
      crossOrigin={image.crossOrigin}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (image.fallbackSrc !== image.src) setFailed(true);
      }}
    />
  );
}
