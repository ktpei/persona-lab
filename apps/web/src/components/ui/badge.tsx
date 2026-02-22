import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-1.5 py-px text-[11px] font-medium tracking-wide transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "bg-primary/12 text-primary",
        secondary: "bg-muted text-muted-foreground",
        destructive: "bg-destructive/12 text-destructive",
        outline: "border border-border/60 text-muted-foreground",
        success: "bg-emerald-500/12 text-emerald-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
