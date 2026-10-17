import type { SamplePhoto } from "@/types/newsletter";

/**
 * Sample photos a lead can attach in the prototype. They are the website's
 * stock workshop placeholders, re-saved without metadata, in
 * public/newsletter-samples/. When photos move to Google Drive, `photo` on a
 * team update becomes a Drive file id and this list goes away.
 */
export const SAMPLE_PHOTOS = [
  { key: "workshop-1", label: "Workshop, group work" },
  { key: "workshop-3", label: "Workshop, at the laptops" },
  { key: "workshop-4", label: "Workshop, presenting" },
  { key: "workshop-6", label: "Workshop, the room" },
] as const;

export type SamplePhotoKey = (typeof SAMPLE_PHOTOS)[number]["key"];

/** The file name under public/newsletter-samples/. */
export function samplePhotoFile(key: string): string | null {
  return SAMPLE_PHOTOS.some((p) => p.key === key) ? `${key}.jpg` : null;
}

/** For the photo picker. `src` is app-absolute; wrap it with withBasePath. */
export function samplePhotoOptions(): SamplePhoto[] {
  return SAMPLE_PHOTOS.map((p) => ({
    key: p.key,
    label: p.label,
    src: `/newsletter-samples/${p.key}.jpg`,
  }));
}
