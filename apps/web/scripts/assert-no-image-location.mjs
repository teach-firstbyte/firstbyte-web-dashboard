/**
 * Fails if any image in public/ carries GPS (location) metadata.
 *
 * Files in public/ are served byte for byte, so anyone can download the
 * original and read where a phone photo was taken. next/image strips metadata
 * from the resized copies it serves, but not from the original URL.
 *
 * What counts as location:
 *   - EXIF with a GPS block (TIFF tag 0x8825). Found by scanning the whole file
 *     for TIFF headers, so it works for JPEG, PNG eXIf, WebP, HEIC and AVIF.
 *   - XMP text with GPSLatitude/GPSLongitude.
 *   - The same two, inside compressed or hex-encoded PNG text chunks (some
 *     editors, e.g. ImageMagick, store EXIF there as "Raw profile type exif").
 *
 * Prints file names only, never the coordinates.
 *
 * Usage: node scripts/assert-no-image-location.mjs [dir]   (default: public)
 */
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { inflateSync } from "node:zlib";

const ROOT = process.argv[2] ?? "public";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
]);

const GPS_IFD_TAG = 0x8825;
const TIFF_HEADERS = [
  Buffer.from("II*\0", "latin1"),
  Buffer.from("MM\0*", "latin1"),
];
const XMP_GPS = [Buffer.from("GPSLatitude"), Buffer.from("GPSLongitude")];
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

async function imageFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await imageFiles(path)));
    else if (IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      found.push(path);
  }
  return found;
}

// True if the TIFF structure at `start` has a GPS pointer in its first IFD.
// Bounds checks double as a filter for byte runs that only look like a header.
function tiffHasGps(buf, start) {
  const le = buf[start] === 0x49;
  const u16 = (at) => (le ? buf.readUInt16LE(at) : buf.readUInt16BE(at));
  const u32 = (at) => (le ? buf.readUInt32LE(at) : buf.readUInt32BE(at));
  if (start + 8 > buf.length) return false;
  const ifd = start + u32(start + 4);
  if (ifd < start + 8 || ifd + 2 > buf.length) return false;
  const count = u16(ifd);
  if (count === 0 || count > 500 || ifd + 2 + count * 12 > buf.length)
    return false;
  for (let n = 0; n < count; n++) {
    if (u16(ifd + 2 + n * 12) === GPS_IFD_TAG) return true;
  }
  return false;
}

function hasGps(buf) {
  if (XMP_GPS.some((marker) => buf.includes(marker))) return true;
  for (const header of TIFF_HEADERS) {
    for (
      let at = buf.indexOf(header);
      at !== -1;
      at = buf.indexOf(header, at + 1)
    ) {
      if (tiffHasGps(buf, at)) return true;
    }
  }
  return false;
}

// The text of a tEXt, zTXt or iTXt chunk, decompressed if needed.
function pngChunkText(type, data, keywordEnd) {
  if (type === "tEXt") return data.subarray(keywordEnd + 1);
  if (type === "zTXt") return inflateSync(data.subarray(keywordEnd + 2));
  // iTXt: compression flag, method, language tag, translated keyword, text.
  const langEnd = data.indexOf(0, keywordEnd + 3);
  const text = data.subarray(data.indexOf(0, langEnd + 1) + 1);
  return data[keywordEnd + 1] === 1 ? inflateSync(text) : text;
}

// Decoded contents of every PNG text chunk.
function pngTexts(buf) {
  const texts = [];
  let at = 8;
  while (at + 8 <= buf.length) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString("latin1", at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + length);
    at += 12 + length;
    const keywordEnd = data.indexOf(0);
    if (!["tEXt", "zTXt", "iTXt"].includes(type) || keywordEnd === -1) continue;
    try {
      const text = pngChunkText(type, data, keywordEnd);
      texts.push(text);
      // "Raw profile type ..." text is "\n<type>\n<length>\n<hex digits>".
      if (
        data.toString("latin1", 0, keywordEnd).startsWith("Raw profile type")
      ) {
        const hex = text
          .toString("latin1")
          .split("\n")
          .slice(3)
          .join("")
          .replace(/\s/g, "");
        texts.push(Buffer.from(hex, "hex"));
      }
    } catch {
      // A corrupt chunk is not this script's concern; the browser will show it or not.
    }
  }
  return texts;
}

let files;
try {
  files = await imageFiles(ROOT);
} catch {
  console.error(`No ${ROOT} directory.`);
  process.exit(1);
}

const offenders = [];
for (const file of files) {
  const buf = await readFile(file);
  const layers = buf.subarray(0, 8).equals(PNG_SIGNATURE)
    ? [buf, ...pngTexts(buf)]
    : [buf];
  if (layers.some(hasGps)) offenders.push(file);
}

if (offenders.length > 0) {
  console.error("These images contain GPS location metadata:\n");
  for (const file of offenders) console.error(`  ${file}`);
  console.error(
    "\nAnyone can download them and see where the photo was taken. Remove the" +
      "\nlocation before committing, for example with" +
      '\n  exiftool -gps:all= -xmp:all= -overwrite_original "<file>"' +
      "\nor on a Mac: open in Preview > Tools > Show Inspector > (i) > GPS > Remove Location Info.",
  );
  process.exit(1);
}

console.log(`No GPS metadata in ${files.length} images.`);
