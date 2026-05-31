import { motion } from "motion/react";
import type { ReactNode } from "react";

type MotionBadgeProps = {
  children: ReactNode;
  delay?: number;
};

export function MotionBadge({ children, delay = 0 }: MotionBadgeProps) {
  return (
    <motion.div
      className="glass-dark"
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: "easeOut" }}
      style={{
        display: "inline-flex",
        padding: "16px 20px",
        fontSize: 24,
        fontWeight: 800,
      }}
    >
      {children}
    </motion.div>
  );
}
