import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { assertProductionWebEnv } from "./build/validateProductionEnv";

export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "production") {
    assertProductionWebEnv({
      ...loadEnv(mode, __dirname, "VITE_"),
      ...process.env
    });
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src")
      }
    }
  };
});

