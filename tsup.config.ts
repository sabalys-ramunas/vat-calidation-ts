import { defineConfig } from "tsup";

const packageVersion = process.env.npm_package_version ?? "0.1.0";

export default defineConfig([
  {
    clean: true,
    define: {
      "process.env.VAT_VALIDATION_TS_VERSION": JSON.stringify(packageVersion),
    },
    dts: true,
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    sourcemap: true,
    target: "node20",
  },
  {
    clean: false,
    define: {
      "process.env.VAT_VALIDATION_TS_VERSION": JSON.stringify(packageVersion),
    },
    dts: false,
    entry: ["src/cli.ts"],
    format: ["esm"],
    banner: {
      js: "#!/usr/bin/env node",
    },
    outExtension() {
      return {
        js: ".js",
      };
    },
    sourcemap: true,
    target: "node20",
  },
]);
