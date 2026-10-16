"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

// Fades its children up the first time they scroll into view. A small client
// wrapper so server components can use the effect.
export function Reveal({
  children,
  className,
  duration = 0.5,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
