// logo component - uses official brand logo.svg (pin + checkmark)
export default function Logo({ className = "size-10", alt = "Attendance" }: Readonly<{ className?: string; alt?: string }>) {
  return (
    <img
      src="/logo.svg"
      alt={alt}
      className={`${className} shrink-0 rounded-xl object-contain bg-white shadow-sm ring-1 ring-border/50`}
      width={40}
      height={40}
      loading="eager"
    />
  );
}
