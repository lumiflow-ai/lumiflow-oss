"use client";

import AnimatedChip from "./AnimatedChip";
import AnimatedLeftLines from "./AnimatedLeftLines";
import AnimatedRightLines from "./AnimatedRightLines";

export default function BannerHome() {
  return (
    <section className="customBGHeroSection container-fluid-plane">
      <div
        className="banner-home"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <AnimatedLeftLines />
        <AnimatedChip />
        <AnimatedRightLines />
      </div>
    </section>
  );
}
