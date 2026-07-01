const fs = require("node:fs");
const path = require("node:path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const dotenv = require("dotenv");

const root = __dirname;
const localEnvPath = path.join(root, ".env.local");

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

module.exports = {
  entry: path.join(root, "src", "main.tsx"),
  output: {
    path: path.join(root, "dist"),
    filename: "assets/[name].[contenthash:8].js",
    assetModuleFilename: "assets/[name].[contenthash:8][ext]",
    clean: true,
    publicPath: "/",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", { targets: "defaults" }],
              ["@babel/preset-react", { runtime: "automatic" }],
              "@babel/preset-typescript",
            ],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpe?g|webp|gif|svg|pdf)$/i,
        type: "asset/resource",
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(root, "index.html"),
      favicon: path.join(root, "public", "favicon.svg"),
    }),
    new webpack.DefinePlugin({
      "process.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env.VITE_SUPABASE_URL ?? "",
      ),
      "process.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        process.env.VITE_SUPABASE_ANON_KEY ?? "",
      ),
    }),
  ],
  devServer: {
    static: {
      directory: path.join(root, "public"),
    },
    historyApiFallback: true,
    hot: true,
    open: false,
    port: 5173,
  },
  performance: {
    hints: false,
  },
};
