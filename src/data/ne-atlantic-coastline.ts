/**
 * Simplified NE-Atlantic coastline for the species distribution basemap —
 * Great Britain, Ireland, and the NW European continent — as [lon, lat] rings.
 *
 * Hand-simplified to a RECOGNISABLE outline calibrated to real headland
 * coordinates (Land's End, John o' Groats, Brest, Malin Head, …); it's for
 * orientation ("this is the UK and the seas around it"), not survey accuracy.
 * Rendered with the same linear lon/lat → viewBox projection as the density
 * grid (the map's viewBox aspect already encodes the cos(midLat) correction),
 * so these coordinates drop straight onto the map.
 *
 * The continent ring is closed along the map's south + east edges (lon 6 /
 * lat 45) so everything east of the coast fills as land, leaving the English
 * Channel and North Sea as sea.
 */

export type LonLat = [number, number];

const GREAT_BRITAIN: LonLat[] = [
  [-5.71, 50.07], // Land's End
  [-4.18, 50.32], // Plymouth
  [-2.94, 50.6], // Portland
  [-1.4, 50.74], // Selsey / IoW
  [-0.1, 50.78], // Brighton
  [1.4, 51.1], // Dover
  [1.27, 51.79], // Felixstowe
  [1.75, 52.48], // Lowestoft (easternmost)
  [0.34, 52.93], // The Wash
  [0.43, 53.72], // Grimsby
  [-0.08, 54.12], // Flamborough Head
  [-1.2, 54.62], // Hartlepool
  [-1.52, 55.02], // Blyth
  [-2.14, 56.0], // Berwick / Dunbar
  [-2.07, 57.14], // Aberdeen
  [-1.78, 57.5], // Fraserburgh
  [-3.02, 58.64], // John o' Groats
  [-4.5, 58.55], // north coast
  [-5.0, 58.62], // Cape Wrath
  [-5.3, 57.9], // Ullapool
  [-6.2, 57.4], // Skye
  [-5.7, 56.7], //
  [-5.6, 56.0], // Mull / Oban
  [-5.45, 55.3], // Mull of Kintyre
  [-4.86, 54.63], // Mull of Galloway
  [-3.6, 54.88], // Solway
  [-3.05, 54.1], // Morecambe
  [-3.05, 53.42], // Liverpool
  [-4.3, 53.3], // Anglesey
  [-4.75, 52.8], // Lleyn
  [-4.7, 52.12], // Cardigan
  [-5.3, 51.88], // St Davids (westernmost Wales)
  [-4.3, 51.66], // Gower
  [-4.66, 50.98], // Hartland Point (N Devon)
  [-5.08, 50.42], // Newquay
];

const IRELAND: LonLat[] = [
  [-7.4, 55.38], // Malin Head (N)
  [-5.93, 55.21], //
  [-5.55, 54.5], // Belfast / Down
  [-6.08, 53.35], // Dublin
  [-6.05, 52.2], // Wexford (SE)
  [-7.6, 52.13], // Waterford
  [-8.3, 51.85], // Cork
  [-9.8, 51.45], // Mizen Head (SW)
  [-10.3, 52.13], // Dingle
  [-9.9, 53.1], // Galway
  [-10.05, 53.97], // Achill (W)
  [-8.65, 54.3], // Sligo
  [-8.45, 55.2], // Donegal NW
];

// NW European continent — coast drawn south→north, then closed along the map's
// SE edges so the landmass fills (everything east of the coast).
const CONTINENT: LonLat[] = [
  [-1.2, 45.0], // SW France at the bottom edge
  [-1.15, 46.1], // La Rochelle
  [-2.2, 47.25], // St Nazaire (Loire)
  [-4.3, 47.8], // south Brittany
  [-4.7, 48.3], // Brest (W tip)
  [-3.5, 48.65], // north Brittany
  [-1.9, 48.65], // St Malo
  [-1.55, 49.7], // Cherbourg
  [0.1, 49.5], // Le Havre (Seine)
  [1.55, 50.75], // Boulogne
  [2.55, 51.08], // Dunkirk
  [3.4, 51.35], // Zeebrugge
  [4.1, 51.98], // Hook of Holland
  [4.75, 52.96], // Den Helder
  [5.7, 53.45], // Frisian coast
  [6.0, 53.6], // east edge of the map
  [6.0, 45.0], // close down the east edge
];

export const COASTLINE_RINGS: LonLat[][] = [GREAT_BRITAIN, IRELAND, CONTINENT];
