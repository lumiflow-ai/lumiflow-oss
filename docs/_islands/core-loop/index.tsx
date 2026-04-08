import React from "react";
import { createRoot } from "react-dom/client";

import CoreLoop from "./CoreLoop";

const mount = document.getElementById("lumiflow-core-loop");

if (mount) {
  createRoot(mount).render(
    <React.StrictMode>
      <CoreLoop />
    </React.StrictMode>,
  );
}
