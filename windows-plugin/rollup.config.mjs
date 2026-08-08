import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/plugin.ts",
  output: { file: "com.nodedeck.monitor.sdPlugin/plugin.js", format: "es", sourcemap: false },
  plugins: [nodeResolve(), commonjs(), typescript({ tsconfig: "./tsconfig.json", declaration: false })]
};
