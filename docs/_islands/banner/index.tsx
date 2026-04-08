import React from "react";
import { createRoot } from "react-dom/client";

import BannerHome from "./BannerHome";

const mount = document.getElementById("lumiflow-banner-animation");

if (mount) {
  createRoot(mount).render(
    <React.StrictMode>
      <BannerHome />
    </React.StrictMode>,
  );
}
