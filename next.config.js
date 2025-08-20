/** @type {import('next').NextConfig} */
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const path = require("path");

module.exports = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.resolve.extensions.push(".ts", ".tsx", ".mjs");
    config.resolve.fallback = { fs: false };

    // We only need to copy on the client side
    if (!isServer) {
      config.plugins.push(
        new NodePolyfillPlugin(),
        new CopyPlugin({
          patterns: [
            {
              from: path.join(
                __dirname,
                "node_modules/onnxruntime-web/dist/*.wasm"
              ),
              to: path.join(__dirname, "public/[name][ext]"),
            },
            {
              from: path.join(
                __dirname,
                "node_modules/onnxruntime-web/dist/*.mjs"
              ),
              to: path.join(__dirname, "public/[name][ext]"),
            },
            {
              from: path.join(
                __dirname,
                "./notebook/en_dict.txt"
              ),
              to: path.join(__dirname, "public/[name][ext]"),
            },
            {
              from: "./model",
              to: "static/chunks/pages",
            },
          ],
        })
      );
    }

    return config;
  },
};
