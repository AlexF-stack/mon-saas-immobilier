import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium [&>svg]:pointer-events-none [&>svg]:size-3 transition-[color,background-color,border-color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
        secondary:
          "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-700 [a&]:hover:bg-rose-100 focus-visible:ring-destructive/20 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300 dark:[a&]:hover:bg-rose-900/35 dark:focus-visible:ring-destructive/40",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-700 [a&]:hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 dark:[a&]:hover:bg-emerald-900/35",
        warning:
          "border-amber-200 bg-amber-50 text-amber-700 [a&]:hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:[a&]:hover:bg-amber-900/35",
        outline:
          "border-slate-300 bg-transparent text-slate-700 [a&]:hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:[a&]:hover:bg-slate-800",
        ghost: "border-transparent text-slate-600 [a&]:hover:bg-slate-100 [a&]:hover:text-slate-900 dark:text-slate-300 dark:[a&]:hover:bg-slate-800 dark:[a&]:hover:text-slate-100",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
