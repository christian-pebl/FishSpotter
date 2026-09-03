import { FARMS } from "@/lib/farms/catalogue";

/**
 * How a location is printed, everywhere.
 *
 * `Snippet.site` is a place name ("Ramsey Sound, Pembrokeshire, Wales, UK"),
 * and that is the right KEY: it is what the archive filters on, what a shared
 * link carries, and what the sync writes. But it is not how people know the
 * places. They know the seaweed farms: Câr-y-Môr, Algapelago, Kelp Crofters.
 * So every surface that shows a location runs it through here and leads with
 * the farm's name: "Câr-y-Môr · Ramsey Sound, Pembrokeshire, Wales, UK".
 *
 * The site string itself is never changed, so filters, URLs and the database
 * are untouched; only what a reader sees. A site that is not a farm (Dale Bay,
 * the Pembrokeshire shore sites, the Netherlands oyster lake) prints as it is.
 *
 * The farm for a site comes from the farm catalogue's `siteNames`, the same
 * file that maps deployments to farms, so there is one place to update when a
 * site is added or renamed.
 */

export const SITE_LABEL_SEPARATOR = " · ";

/** The farm whose clips are filed under this site, or null for a non-farm site. */
export function farmForSite(site: string | null | undefined): { slug: string; name: string } | null {
  if (!site) return null;
  for (const [slug, farm] of Object.entries(FARMS)) {
    if (farm.siteNames.includes(site)) return { slug, name: farm.name };
  }
  return null;
}

/** The farm name (if any) and the place, for surfaces that style them apart. */
export function siteLabelParts(site: string): { farm: string | null; place: string } {
  return { farm: farmForSite(site)?.name ?? null, place: site };
}

/** "Câr-y-Môr · Ramsey Sound, Pembrokeshire, Wales, UK", or the site as it is. */
export function siteLabel(site: string): string {
  const farm = farmForSite(site);
  return farm ? `${farm.name}${SITE_LABEL_SEPARATOR}${site}` : site;
}

/**
 * The short form for lists and tight spaces: the farm and the leading segment
 * of the place, "Câr-y-Môr · Ramsey Sound". The leading segment is the
 * recognisable part; the county and country tail is what makes a joined list
 * of sites unreadable.
 */
export function shortSiteLabel(site: string): string {
  const place = site.split(",")[0]?.trim() ?? "";
  if (!place) return "";
  const farm = farmForSite(site);
  return farm ? `${farm.name}${SITE_LABEL_SEPARATOR}${place}` : place;
}
