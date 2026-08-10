"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

export function AnimatedNumber({
  value,
  format = (val: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(val),
  className,
}: {
  value: number;
  format?: (val: number) => string;
  className?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  // Increased stiffness to make it twice as fast
  const springValue = useSpring(0, { stiffness: 400, damping: 50, bounce: 0 });
  const displayValue = useTransform(springValue, (current) => format(current));

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    springValue.set(value);
  }, [springValue, value]);

  if (!isMounted) {
    return <span className={className}>{format(value)}</span>;
  }

  return <motion.span className={className}>{displayValue}</motion.span>;
}
