import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HoverCardProps {
  children: React.ReactNode;
  className?: string;
  tiltAmount?: number;
  scale?: number;
  glowEffect?: boolean;
  magneticCursor?: boolean;
  disabled?: boolean;
}

export const HoverCard: React.FC<HoverCardProps> = ({
  children,
  className,
  tiltAmount = 15,
  scale = 1.05,
  glowEffect = false,
  magneticCursor = false,
  disabled = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 20 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [tiltAmount, -tiltAmount]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-tiltAmount, tiltAmount]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const centerX = rect.left + width / 2;
    const centerY = rect.top + height / 2;

    const mouseXPos = event.clientX - centerX;
    const mouseYPos = event.clientY - centerY;

    const xPct = mouseXPos / (width / 2);
    const yPct = mouseYPos / (height / 2);

    x.set(xPct);
    y.set(yPct);

    if (magneticCursor) {
      const magnetX = mouseXPos * 0.1;
      const magnetY = mouseYPos * 0.1;
      ref.current.style.transform = `translate(${magnetX}px, ${magnetY}px)`;
    }
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
    if (magneticCursor && ref.current) {
      ref.current.style.transform = 'translate(0px, 0px)';
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <motion.div
      ref={ref}
      className={cn(
        'relative transform-gpu transition-all duration-300',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        rotateX: disabled ? 0 : rotateX,
        rotateY: disabled ? 0 : rotateY,
        transformStyle: 'preserve-3d',
      }}
      animate={{
        scale: disabled || !isHovered ? 1 : scale,
      }}
      transition={{
        scale: { duration: 0.2, ease: 'easeOut' },
      }}
    >
      <div
        className={cn(
          'relative z-10 h-full w-full',
          isHovered && !disabled && 'shadow-2xl'
        )}
      >
        {children}
      </div>

      {glowEffect && !disabled && (
        <motion.div
          className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 blur-xl"
          animate={{
            opacity: isHovered ? 0.6 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
      )}

      <div
        className={cn(
          'absolute inset-0 -z-20 rounded-lg bg-black/5 transition-all duration-300',
          isHovered && !disabled && 'translate-y-2 scale-95 blur-md'
        )}
      />
    </motion.div>
  );
};