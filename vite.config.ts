import { defineConfig } from "vite";

export default defineConfig({
  server: {
    watch: {
      // Rust and its local toolchain have their own watchers and many build files.
      ignored: ["**/src-tauri/**", "**/.tools/**", "**/output/**"],
    },
    warmup: {
      clientFiles: ["./src/main.ts", "./src/style.css", "./src/themes.css"],
    },
  },
});
