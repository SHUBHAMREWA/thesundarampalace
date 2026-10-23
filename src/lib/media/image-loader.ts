// next/image loader (configured in next.config.ts). Every next/image `src` in
// this app is a Cloudinary public ID; delivery is optimised by Cloudinary.
import { cloudinaryImageUrl } from "./cloudinary";

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  return cloudinaryImageUrl(src, width);
}
