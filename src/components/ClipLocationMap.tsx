"use client";

import { useEffect, useRef } from "react";

interface Props {
  lat: number;
  lon: number;
  zoom?: number;
  className?: string;
}

/**
 * Tiny static-feeling Leaflet map. Loaded purely on the client (no SSR) because
 * Leaflet touches `window`. We import the library lazily to keep server bundles
 * lean, and reuse a single map instance per mount.
 */
export function ClipLocationMap({ lat, lon, zoom = 8, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      // Inject Leaflet CSS once
      if (typeof document !== "undefined" && !document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        center: [lat, lon],
        zoom,
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false,
        touchZoom: true,
        minZoom: 3,
        maxZoom: 14,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(map);

      const pin = L.divIcon({
        className: "fishspotter-pin",
        html: `<span style="
          display:block;width:14px;height:14px;border-radius:50%;
          background:#3AAFA9;border:2px solid #fff;
          box-shadow:0 0 0 2px rgba(58,175,169,0.4),0 1px 4px rgba(0,0,0,0.3);
        "></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([lat, lon], { icon: pin }).addTo(map);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lon, zoom]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        background: "#0e1a1d",
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
}
