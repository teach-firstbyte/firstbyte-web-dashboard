"use client";

import { motion, useAnimationControls } from "framer-motion";
import { Linkedin, Instagram } from "lucide-react";
import { LinktreeIcon } from "@/components/ui/icons";
import { useTooltip, BlurTooltip } from "@/components/ui/blur-tooltip";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  if (element) {
    const offset = 100; // Adjust this value to change how far below the section it scrolls
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  }
};

export function Footer() {
  const {
    tooltipRect,
    tooltipContent,
    tooltipVisible,
    handleTooltipShow,
    handleTooltipHide,
  } = useTooltip();

  // Animation controls for the grid lines
  const gridControls = useAnimationControls();
  const [isHovered, setIsHovered] = useState(false);

  // Animate grid lines
  useEffect(() => {
    gridControls.start({
      opacity: isHovered ? [0.2, 0.4, 0.2] : [0.05, 0.15, 0.05],
      scale: isHovered ? [1, 1.05, 1] : [1, 1.02, 1],
      transition: {
        duration: isHovered ? 2 : 4,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      },
    });
  }, [isHovered, gridControls]);

  return (
    <footer
      className="relative py-12 px-4 border-t overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animating grid lines with green glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <motion.div
          className="absolute inset-0"
          animate={gridControls}
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(22, 163, 74, 0.15), transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/FirstByteBitex4.png"
                alt="FirstByte Logo"
                width={28}
                height={28}
                className="w-7 h-7"
              />
              <h3 className="font-bold text-xl">FirstByte</h3>
            </div>
            <p className="text-muted-foreground mb-4 max-w-md">
              Empowering the next generation through accessible, engaging, and
              effective computer science and STEM education.
            </p>
            <div className="flex space-x-6">
              <motion.a
                href="https://www.instagram.com/teachfirstbyte"
                target="_blank"
                className="text-foreground/80 hover:text-primary transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={(e) => handleTooltipShow("Instagram", e)}
                onMouseLeave={handleTooltipHide}
              >
                <Instagram className="h-5 w-5" />
              </motion.a>
              <motion.a
                href="https://www.linkedin.com/company/firstbyte"
                target="_blank"
                className="text-foreground/80 hover:text-primary transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={(e) => handleTooltipShow("LinkedIn", e)}
                onMouseLeave={handleTooltipHide}
              >
                <Linkedin className="h-5 w-5" />
              </motion.a>
              <motion.a
                href="https://linktr.ee/firstbyte"
                target="_blank"
                className="text-foreground/80 hover:text-primary transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={(e) => handleTooltipShow("Linktree", e)}
                onMouseLeave={handleTooltipHide}
              >
                <LinktreeIcon className="h-5 w-5" />
              </motion.a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <motion.li whileHover={{ x: 5 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/#about"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection("about");
                  }}
                >
                  About Us
                </Link>
              </motion.li>
              <motion.li whileHover={{ x: 5 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/#programs"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection("programs");
                  }}
                >
                  Our Programs
                </Link>
              </motion.li>
              <motion.li whileHover={{ x: 5 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/#team"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection("team");
                  }}
                >
                  Our Team
                </Link>
              </motion.li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Contact Us</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    href="https://mail.google.com/mail/u/0/?fs=1&tf=cm&source=mailto&to=info@firstbyte.org"
                    target="_blank"
                    className="text-muted-foreground hover:text-foreground transition-colors flex flex-col"
                  >
                    <div className="flex flex-row gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 mt-0.5 text-muted-foreground"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      <div>teachfirstbyte@gmail.com</div>
                    </div>
                  </Link>
                </motion.div>
              </li>
              <li className="flex items-start gap-2">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    href="https://www.google.com/maps/dir//Northeastern+University,+360+Huntington+Ave,+Boston,+MA+02115/"
                    target="_blank"
                    className="text-muted-foreground hover:text-foreground transition-colors flex flex-col"
                  >
                    <div className="flex flex-row gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 mt-0.5 text-muted-foreground"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      <div className="flex flex-col">
                        <div>Northeastern University</div>
                        <div>360 Huntington Ave</div>
                        <div>Boston, MA 02115</div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Render the tooltip */}
      {tooltipRect && (
        <BlurTooltip
          position={tooltipRect}
          content={tooltipContent}
          visible={tooltipVisible}
          id="footer-tooltip"
        />
      )}
    </footer>
  );
}
