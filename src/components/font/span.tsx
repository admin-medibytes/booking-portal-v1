import localFont from "next/font/local";
import { cn } from "@/lib/utils";

const brandFont = localFont({ src: "../font/CerebriSans.otf" });

export function BrandSpan(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-semibold tracking-widest",
        brandFont.className,
        props.className,
      )}
    >
      {props.children}
    </span>
  );
}
