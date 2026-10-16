"use client";

import { motion } from "framer-motion";
import {
  Puzzle,
  Code,
  Laptop,
  GraduationCap,
  Lightbulb,
  Users,
  type LucideIcon,
} from "lucide-react";
import { forwardRef } from "react";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import Image from "next/image";

interface ProgramFeature {
  title: string;
  icon: LucideIcon;
  description: string;
  image: string;
  link: string;
}

const programs: ProgramFeature[] = [
  {
    title: "CS Education",
    icon: Laptop,
    description:
      "We lead various workshops with organizations like Camp Harbor View, teaching students computer science fundamentals like web development, Python, Scratch, and more!",
    image: "/programs/CHV.jpeg",
    link: "/programs/#cs-education",
  },
  {
    title: "Northeastern Workshops",
    icon: Code,
    description:
      "We run specialized workshops at Northeastern, for Northeastern students, covering essential developer skills including React, Git, and command-line tools.",
    image: "/programs/GM.jpg",
    link: "/programs/#stem-education",
  },
  {
    title: "Hackathons",
    icon: Puzzle,
    description:
      "We help organize hackathons in collaboration with student organizations like HackBeanPot and ViTAL, creating opportunities for students to apply their skills to real-world challenges.",
    image: "/programs/VITAL.jpeg",
    link: "/programs/#hackathons",
  },
  {
    title: "STEM Education",
    icon: Lightbulb,
    description:
      "We partner with organizations like Saint Stephens Youth Program to deliver engaging STEM activities that make technical concepts accessible and fun for all students.",
    image: "/programs/SSYP.jpeg",
    link: "/programs/#stem-education",
  },
  {
    title: "Mentorship",
    icon: GraduationCap,
    description:
      "We provide resume review sessions and presentation practice to help students prepare for technical interviews and professional opportunities.",
    image: "/programs/CHV2.jpeg",
    link: "/programs/#mentorship",
  },
  {
    title: "Engineering Team",
    icon: Users,
    description:
      "Our student-led engineering team develops and maintains our website and other digital resources, providing hands-on experience in software development.",
    image: "/programs/ENGINEERING.png",
    link: "/programs/#engineering-team",
  },
];

// Bento layout and entry direction for each card, by position in `programs`.
const cardLayouts = [
  // Large 2x2 card
  { className: "md:col-span-2 md:row-span-2", initialX: -20, initialY: -20 },
  // Small 1x1 card
  { className: "md:col-span-1 md:row-span-1", initialX: 20, initialY: -20 },
  // Small 1x1 card
  { className: "md:col-span-1 md:row-span-1", initialX: -20, initialY: 20 },
  // Large 2x2 card
  { className: "md:col-span-2 md:row-span-2", initialX: 20, initialY: 20 },
  // Small 1x1 card
  { className: "md:col-span-1 md:row-span-1", initialX: -20, initialY: -20 },
  // Small 1x1 card
  { className: "md:col-span-1 md:row-span-1", initialX: 20, initialY: -20 },
];

// Built once at module load, so each BentoCard gets the same props (including
// the `background` element) on every render and its memo can skip re-renders.
const programCards = programs.map((program, index) => ({
  name: program.title,
  Icon: program.icon,
  description: program.description,
  href: program.link,
  cta: "Learn more",
  ...(cardLayouts[index] ?? { className: "", initialX: 0, initialY: 0 }),
  background: (
    <div className="absolute inset-0 h-full w-full">
      <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/20 to-black/40 z-20 transition-opacity duration-300 group-hover:opacity-75" />
      <Image
        src={program.image}
        alt={program.title}
        width={500}
        height={300}
        className="object-cover object-center absolute inset-0 h-full w-full transition-transform duration-300 will-change-transform group-hover:scale-105"
      />
    </div>
  ),
}));

export const ProgramsSection = forwardRef<HTMLElement>((props, ref) => {
  return (
    <section
      ref={ref}
      id="programs"
      className="pt-32 pb-6 sm:pb-8 md:pb-10 px-3 sm:px-4 md:px-6 lg:px-8 bg-[hsl(var(--gray-200))] relative overflow-hidden"
    >
      {/* Simple Line Grid Background */}
      <div className="absolute top-0 left-0 right-0 w-full h-[600px] overflow-hidden pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            background: `
              repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(180, 180, 180, 0.2) 40px),
              repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(180, 180, 180, 0.2) 40px)
            `,
            backgroundSize: "40px 40px",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/* Animated Green Lines */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)",
          }}
        >
          {/* First Line - Horizontal */}
          <div
            className="absolute h-px bg-green-400 opacity-70"
            style={{
              width: "360px",
              left: "calc(80px - 1px)",
              top: "calc(80px - 1px)",
              boxShadow: "0 0 6px 1px rgba(74, 222, 128, 0.7)",
              animation: "traceGridLine4 8s infinite",
              transformOrigin: "left center",
            }}
          />

          {/* Second Line - Vertical */}
          <div
            className="absolute w-px bg-green-400 opacity-70"
            style={{
              height: "240px",
              left: "calc(320px - 1px)",
              top: "calc(40px - 1px)",
              boxShadow: "0 0 6px 1px rgba(74, 222, 128, 0.7)",
              animation: "traceGridLine5 10s infinite",
              animationDelay: "1s",
              transformOrigin: "top center",
            }}
          />

          {/* Third Line - L shape following grid lines */}
          <div
            className="absolute"
            style={{ right: "calc(200px - 1px)", top: "calc(120px - 1px)" }}
          >
            {/* Horizontal part of L */}
            <div
              className="absolute h-px bg-green-400 opacity-70"
              style={{
                width: "160px",
                boxShadow: "0 0 6px 1px rgba(74, 222, 128, 0.7)",
                animation: "traceGridLineHorizontal 7s infinite",
                animationDelay: "0.5s",
                transformOrigin: "left center",
              }}
            />
            {/* Vertical part of L */}
            <div
              className="absolute w-px bg-green-400 opacity-70"
              style={{
                height: "200px",
                left: "calc(160px - 1px)",
                boxShadow: "0 0 6px 1px rgba(74, 222, 128, 0.7)",
                animation: "traceGridLineVertical 7s infinite",
                animationDelay: "3s",
                transformOrigin: "top center",
              }}
            />
          </div>

          {/* Fourth Line - Horizontal */}
          <div
            className="absolute h-px bg-green-400 opacity-70"
            style={{
              width: "240px",
              right: "calc(80px - 1px)",
              top: "calc(200px - 1px)",
              boxShadow: "0 0 6px 1px rgba(74, 222, 128, 0.7)",
              animation: "traceGridLine4 7.5s infinite",
              animationDelay: "2s",
              transformOrigin: "right center",
            }}
          />

          {/* Fifth Line - Vertical */}
          <div
            className="absolute w-px bg-green-400 opacity-70"
            style={{
              height: "280px",
              left: "calc(160px - 1px)",
              top: "calc(120px - 1px)",
              boxShadow: "0 0 6px 1px rgba(74, 222, 128, 0.7)",
              animation: "traceGridLine5 9s infinite",
              animationDelay: "3.5s",
              transformOrigin: "top center",
            }}
          />

          {/* Sixth Line - Z shape */}
          <div
            className="absolute"
            style={{ left: "calc(400px - 1px)", top: "calc(240px - 1px)" }}
          >
            {/* Top horizontal part of Z */}
            <div
              className="absolute h-px bg-green-400 opacity-70"
              style={{
                width: "120px",
                boxShadow: "0 0 6px 1px rgba(74, 222, 128, 0.7)",
                animation: "traceGridLineHorizontal 8.5s infinite",
                animationDelay: "1.5s",
                transformOrigin: "left center",
              }}
            />
            {/* Diagonal part of Z - using transforms */}
            <div
              className="absolute h-px bg-green-400 opacity-70"
              style={{
                width: "141px",
                left: "calc(120px - 1px)",
                boxShadow: "0 0 6px 1px rgba(74, 222, 128, 0.7)",
                animation: "traceGridLineDiagonal 8.5s infinite",
                animationDelay: "3.5s",
                transformOrigin: "left center",
                transform: "rotate(45deg)",
                transformBox: "fill-box",
              }}
            />
            {/* Bottom horizontal part of Z */}
            <div
              className="absolute h-px bg-green-400 opacity-70"
              style={{
                width: "120px",
                top: "calc(120px - 1px)",
                boxShadow: "0 0 6px 1px rgba(74, 222, 128, 0.7)",
                animation: "traceGridLineHorizontal 8.5s infinite",
                animationDelay: "5.5s",
                transformOrigin: "left center",
              }}
            />
          </div>

          <style jsx>{`
            @keyframes traceGridLine4 {
              0% {
                transform: scaleX(0);
                opacity: 0;
              }
              5% {
                opacity: 0.7;
              }
              20% {
                transform: scaleX(1);
              }
              35%,
              100% {
                transform: translateX(110%) scaleX(0);
                opacity: 0;
              }
            }

            @keyframes traceGridLine5 {
              0% {
                transform: scaleY(0);
                opacity: 0;
              }
              5% {
                opacity: 0.7;
              }
              25% {
                transform: scaleY(1);
              }
              45%,
              100% {
                transform: translateY(120%) scaleY(0);
                opacity: 0;
              }
            }

            @keyframes traceGridLineHorizontal {
              0% {
                transform: scaleX(0);
                opacity: 0;
              }
              10% {
                opacity: 0.7;
                transform: scaleX(1);
              }
              25%,
              100% {
                opacity: 0;
              }
            }

            @keyframes traceGridLineVertical {
              0% {
                transform: scaleY(0);
                opacity: 0;
              }
              5% {
                opacity: 0.7;
              }
              25% {
                transform: scaleY(1);
              }
              40%,
              100% {
                opacity: 0;
              }
            }

            @keyframes traceGridLineDiagonal {
              0% {
                transform: rotate(45deg) scaleX(0);
                opacity: 0;
              }
              10% {
                opacity: 0.7;
                transform: rotate(45deg) scaleX(1);
              }
              25%,
              100% {
                opacity: 0;
              }
            }
          `}</style>
        </div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-12 mb-8 sm:mb-12 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="self-end"
          >
            <h2 className="text-3xl font-semibold leading-tight sm:text-5xl sm:leading-tight">
              What We Do
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground">
              Our programs are designed to inspire curiosity, build confidence,
              and develop critical thinking skills through hands-on learning
              experiences.
            </p>
          </motion.div>
        </div>

        <BentoGrid className="md:auto-rows-64 grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
          {programCards.map((card) => (
            <BentoCard key={card.name} {...card} />
          ))}
        </BentoGrid>

        <motion.div
          className="mt-8 sm:mt-10 md:mt-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        ></motion.div>
      </div>
    </section>
  );
});

ProgramsSection.displayName = "ProgramsSection";
