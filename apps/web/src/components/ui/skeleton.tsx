import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-md bg-muted bg-gradient-to-r from-transparent via-black/5 dark:via-white/10 to-transparent bg-[length:400%_100%]", className)}
      {...props}
    />
  )
}

export { Skeleton }
