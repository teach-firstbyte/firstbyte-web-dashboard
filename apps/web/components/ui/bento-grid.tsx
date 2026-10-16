import { ComponentType, ReactNode, memo } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

const BentoGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn("grid w-full auto-rows-72 grid-cols-3 gap-4", className)}
    >
      {children}
    </div>
  );
};

// Memoized so the card only re-renders when its own props change. Without it,
// every parent re-render (the homepage re-renders on each mouse move) re-ran
// this card and its image.
const BentoCard = memo(function BentoCard({
  name,
  className,
  background,
  Icon,
  description,
  initialX,
  initialY,
}: {
  name: string;
  className: string;
  background: ReactNode;
  Icon: ComponentType<{ className?: string }>;
  description: string;
  href: string;
  cta: string;
  initialX?: number;
  initialY?: number;
}) {
  return (
    <motion.div
      key={name}
      initial={{ opacity: 0, x: initialX, y: initialY }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl",
        "bg-white",
        "transform-gpu",
        "cursor-pointer",
        className,
      )}
    >
      {/* <Link href={href} className="absolute inset-0 z-20" /> */}
      <div className="overflow-hidden">
        {background}
        <div className="absolute inset-0 bg-black/30 md:bg-black/10 backdrop-blur-[1px] md:backdrop-blur-[0px] transition-all duration-300 md:group-hover:bg-black/40 md:group-hover:backdrop-blur-[2px] z-10"></div>
      </div>
      <div className="pointer-events-none absolute bottom-0 z-20 flex transform-gpu flex-col gap-1 p-5 transition-all duration-300 md:group-hover:opacity-0 md:opacity-100 opacity-0">
        <Icon className="h-10 w-10 origin-left transform-gpu text-neutral-300 ease-in-out" />
        <h3 className="text-lg font-semibold text-neutral-300">{name}</h3>
      </div>

      <div className="pointer-events-none absolute bottom-0 z-20 flex w-full transform-gpu flex-col items-start p-5 md:opacity-0 opacity-100 transition-all duration-300 md:group-hover:opacity-100">
        <div className="transform-gpu md:translate-y-16 md:group-hover:translate-y-0 transition-all duration-300">
          <Icon className="h-10 w-10 origin-left text-neutral-300" />
          <h3 className="text-lg font-semibold text-neutral-300">{name}</h3>
        </div>

        <div className="mt-2 flex flex-col transform-gpu md:translate-y-10 md:opacity-0 opacity-100 transition-all delay-100 duration-300 md:group-hover:translate-y-0 md:group-hover:opacity-100">
          <p className="max-w-lg text-sm text-neutral-300">{description}</p>
          {/* <div className="mt-2 flex items-center text-neutral-300">
          {cta}
          <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div> */}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 md:group-hover:bg-black/3 md:dark:group-hover:bg-neutral-800/10" />
    </motion.div>
  );
});

export { BentoCard, BentoGrid };
