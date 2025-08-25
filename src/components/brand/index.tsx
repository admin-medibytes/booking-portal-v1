import localFont from "next/font/local";
import { cn } from "@/lib/utils";

const brandFont = localFont({ src: "../font/CerebriSans.otf" });

export default function Brand({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("font-semibold tracking-widest", brandFont.className, className)}>
      {children}
    </span>
  );
}
