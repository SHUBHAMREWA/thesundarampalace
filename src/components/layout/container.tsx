import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Centred content column (max width from --container-max, 16px gutters on mobile). */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-site px-4 md:px-8", className)} {...props} />;
}
