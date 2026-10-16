"use client";

import { useEffect, useId, useState } from "react";
import { Info } from "lucide-react";
import { BlurTooltip, TooltipPosition } from "@/components/ui/blur-tooltip";

// Opening one badge's tooltip closes the others, so only one shows at a time
const OPEN_EVENT = "revival-team-badge-open";

// The "Revival Team" badge on a team card. Desktop shows the explanation on
// hover; phones show it on tap and hide it on the next tap anywhere.
export function RevivalTeamBadge() {
  const id = useId();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] =
    useState<TooltipPosition | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const closeIfOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id)
        setTooltipVisible(false);
    };
    document.addEventListener(OPEN_EVENT, closeIfOther);
    return () => document.removeEventListener(OPEN_EVENT, closeIfOther);
  }, [id]);

  // Close the tooltip when clicking elsewhere (mobile)
  useEffect(() => {
    if (!isMobile || !tooltipVisible) return;

    const handleClickOutside = () => setTooltipVisible(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isMobile, tooltipVisible]);

  const followMouse = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (isMobile) return;
    setTooltipPosition({ x: event.clientX, y: event.clientY + 15 });
    setTooltipVisible(true);
  };

  return (
    <>
      <span
        className={`inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-1 text-xs font-medium ${isMobile ? "cursor-pointer" : "cursor-default"}`}
        onMouseEnter={followMouse}
        onMouseMove={followMouse}
        onMouseLeave={() => {
          if (!isMobile) setTooltipVisible(false);
        }}
        onClick={(event) => {
          if (!isMobile) return;
          event.stopPropagation();

          // Center tooltip under the badge
          const rect = event.currentTarget.getBoundingClientRect();
          setTooltipPosition({
            x: rect.left + rect.width / 2,
            y: rect.bottom + 10,
          });
          if (!tooltipVisible) {
            document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
          }
          setTooltipVisible(!tooltipVisible);
        }}
      >
        <Info className="h-3 w-3 mr-1" />
        Revival Team
      </span>

      {tooltipPosition && (
        <BlurTooltip
          position={tooltipPosition}
          content="As the only active members during this year, this team revitalized the club from the ground up and established the foundation for what FirstByte is today."
          visible={tooltipVisible}
          id={`revival-team-badge-info-${id}`}
          className="max-w-[250px]"
          hideIcon={true}
        />
      )}
    </>
  );
}
