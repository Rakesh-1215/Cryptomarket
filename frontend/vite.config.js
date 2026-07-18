const { defineConfig } = require("vite");
const reactPlugin = require("@vitejs/plugin-react");

module.exports = defineConfig({
  plugins: [reactPlugin()],
  server: {
    port: 5000,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
