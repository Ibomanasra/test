import { cn } from "@/components/ui";

/** Produktbild oder neutraler Platzhalter mit Initialen */
export function ProductImage({ imageId, name, className }: { imageId?: string | null; name: string; className?: string }) {
  if (imageId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/v1/images/${imageId}`} alt={name} loading="lazy" className={cn("aspect-square w-full rounded-lg bg-white object-contain", className)} />;
  }
  const initials = name.replace(/\(.*?\)/g, "").trim().slice(0, 2);
  return (
    <div aria-hidden className={cn("grid aspect-square w-full place-items-center rounded-lg bg-gradient-to-br from-brand-50 to-ink-100 text-3xl font-bold text-brand-700", className)}>
      {initials}
    </div>
  );
}
