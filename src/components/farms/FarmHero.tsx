import type { FarmImage } from "@/lib/farms/traits";

/**
 * Full-bleed hero banner for a farm profile: a real photo of the farm with a
 * dark scrim and the farm's name + location laid over it. Server-rendered.
 * Locally hosted image (public/farm-media/...), so no external request.
 */
export function FarmHero({
  image,
  name,
  place,
  legalName,
}: {
  image: FarmImage;
  name: string;
  place: string;
  legalName?: string;
}) {
  return (
    <div className="relative -mx-4 aspect-[16/10] overflow-hidden sm:aspect-[2/1] sm:rounded-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/ */}
      <img
        src={image.src}
        alt={image.alt}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
      />
      {/* Scrim so the overlaid title stays legible over any photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/25 to-navy-900/10" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-200">{place}</p>
        <h1 className="mt-1 font-brand-heading text-h1 text-white drop-shadow-sm">{name}</h1>
        {legalName && <p className="mt-0.5 text-sm italic text-white/70">{legalName}</p>}
      </div>
    </div>
  );
}
