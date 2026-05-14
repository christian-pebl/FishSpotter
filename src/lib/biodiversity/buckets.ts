export type BucketKey = {
  latBucket: number;
  lonBucket: number;
  depthBucket: number;
  month: number;
};

export type BucketInput = {
  lat: number | null | undefined;
  lon: number | null | undefined;
  depthM: number | null | undefined;
  recordingDatetime: string | null | undefined;
};

export const DEPTH_BUCKET_NULL = -1;

export function bucketFor(snippet: BucketInput): BucketKey | null {
  if (snippet.lat == null || snippet.lon == null || !snippet.recordingDatetime) {
    return null;
  }
  const parsed = new Date(snippet.recordingDatetime);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    latBucket: Math.round(snippet.lat * 10) / 10,
    lonBucket: Math.round(snippet.lon * 10) / 10,
    depthBucket:
      snippet.depthM == null
        ? DEPTH_BUCKET_NULL
        : Math.floor(snippet.depthM / 10) * 10,
    month: parsed.getUTCMonth() + 1,
  };
}

export function monthsAround(month: number): number[] {
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  return [prev, month, next];
}
