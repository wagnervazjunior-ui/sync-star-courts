import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-bold tracking-tight", className)}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="oklch(0.74 0.19 50)" />
            <stop offset="100%" stopColor="oklch(0.62 0.14 230)" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14" stroke="url(#logoGrad)" strokeWidth="3" />
        <path d="M8 16 Q16 6 24 16 Q16 26 8 16 Z" fill="url(#logoGrad)" opacity="0.9" />
      </svg>
      <span className="text-lg">
        <span className="text-gradient">OPEN</span>
        <span className="text-foreground"> SYNC</span>
      </span>
    </div>
  );
}
