"use client";

import { useMemo } from "react";

interface MiniMapStaticProps {
  lat: number;
  lon: number;
  onClick?: () => void;
  size?: number;
}

// OSM tile math (Web Mercator)
function lonToTileX(lon: number, z: number) {
  return ((lon + 180) / 360) * Math.pow(2, z);
}
function latToTileY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * Math.pow(2, z);
}

const ZOOM = 8; // ~157km tile at lat 50 → Cornwall-sized

export function MiniMapStatic({ lat, lon, onClick, size = 180 }: MiniMapStaticProps) {
  const { tileUrl, dotXPct, dotYPct } = useMemo(() => {
    const fx = lonToTileX(lon, ZOOM);
    const fy = latToTileY(lat, ZOOM);
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    return {
      tileUrl: `https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`,
      dotXPct: (fx - tx) * 100,
      dotYPct: (fy - ty) * 100,
    };
  }, [lat, lon]);

  const Wrapper: "button" | "div" = onClick ? "button" : "div";

  return (
    <Wrapper
      {...(onClick ? { type: "button", onClick, "aria-label": "Open larger map" } : {})}
      className="relative block overflow-hidden rounded-xl border border-white/15 bg-[#0f1d22] transition-colors hover:border-[#3AAFA9]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3AAFA9]"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tileUrl}
        alt=""
        width={256}
        height={256}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-cover opacity-90"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      {/* dot + halo at fractional position */}
      <span
        aria-hidden
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${dotXPct}%`,
          top: `${dotYPct}%`,
          width: 22,
          height: 22,
          background: "radial-gradient(circle, rgba(58,175,169,0.55) 0%, rgba(58,175,169,0) 70%)",
        }}
      />
      <span
        aria-hidden
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/90"
        style={{
          left: `${dotXPct}%`,
          top: `${dotYPct}%`,
          width: 9,
          height: 9,
          background: "#3AAFA9",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
        }}
      />
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white/80">
        © OSM
      </span>
    </Wrapper>
  );
}
