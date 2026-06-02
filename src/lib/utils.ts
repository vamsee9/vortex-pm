/**
 * utils.ts
 * --------
 * Utility helpers used across the entire app.
 * The cn() function merges Tailwind classes without conflicts.
 * This is required by all Shadcn/ui components.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
