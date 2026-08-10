"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import React from "react";

export function StaggerContainer({ children, className, delay = 0.1, staggerDuration = 0.05, ...props }: HTMLMotionProps<"div"> & { delay?: number; staggerDuration?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            delayChildren: delay,
            staggerChildren: staggerDuration,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { type: "spring", stiffness: 300, damping: 24 },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
