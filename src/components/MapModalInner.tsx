"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapModalInnerProps {
  lat: number;
  lon: number;
  site: string;
}

export default function MapModalInner({ lat, lon, site }: MapModalInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: [lat, lon],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const icon = L.divIcon({
      className: "fs-map-marker",
      html: `<span class="fs-map-marker-dot"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker([lat, lon], { icon })
      .addTo(map)
      .bindPopup(`<strong>${site}</strong><br/>${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    // ensure correct size after mount inside an animated modal
    const t = window.setTimeout(() => map.invalidateSize(), 60);

    return () => {
      window.clearTimeout(t);
      map.remove();
    };
  }, [lat, lon, site]);

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />
      <style jsx global>{`
        .fs-map-marker-dot {
          display: block;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #3aafa9;
          box-shadow:
            0 0 0 3px rgba(255, 255, 255, 0.95),
            0 0 0 5px rgba(58, 175, 169, 0.35);
        }
      `}</style>
    </>
  );
}
