import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-crimson text-paper hover:bg-crimson-dark",
  secondary: "bg-paper text-ink ring-1 ring-ink hover:bg-cream",
  ghost: "text-ink-2 hover:bg-sand",
  danger: "bg-paper text-fail ring-1 ring-fail/40 hover:bg-fail-soft",
};

/** Zapier-style pill button. */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; children: ReactNode }) {
  const sizes = { sm: "px-3.5 py-1.5 text-[13px]", md: "px-5 py-2.5 text-[15px]", lg: "px-6 py-3 text-[16px]" };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${sizes[size]} ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" width={compact ? 26 : 32} height={compact ? 19 : 23} />
      <div className="leading-none">
        <div className="text-[10px] font-semibold tracking-[0.12em] text-crimson uppercase">Gen AI Club</div>
        <div className={`display ${compact ? "text-[15px]" : "text-[17px]"} mt-0.5`}>Workflow Lab</div>
      </div>
    </div>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`eyebrow flex items-center gap-2 ${className}`}>
      <span className="h-[2px] w-4 rounded-full bg-crimson" />
      {children}
    </div>
  );
}
