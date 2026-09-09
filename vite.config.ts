import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/em_radiation_playground/",
  plugins: [react()]
});
