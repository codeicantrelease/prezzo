import React from "react";
import { createRoot } from "react-dom/client";
import { PrezzoDeck } from "./Deck";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <React.StrictMode>
    <PrezzoDeck />
  </React.StrictMode>,
);
