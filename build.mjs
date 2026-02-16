import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  minify: false,
  sourcemap: false,
  target: "es2020",
  outdir: "dist",
};

const contentBuild = { ...shared, entryPoints: ["src/content.ts"], format: "iife" };
const viewerBuild = { ...shared, entryPoints: ["src/viewer.ts"], format: "iife" };
const backgroundBuild = { ...shared, entryPoints: ["src/background.ts"], format: "esm" };

if (watch) {
  const contexts = await Promise.all([
    esbuild.context(contentBuild),
    esbuild.context(viewerBuild),
    esbuild.context(backgroundBuild),
  ]);
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("Watching for changes...");
} else {
  await Promise.all([
    esbuild.build(contentBuild),
    esbuild.build(viewerBuild),
    esbuild.build(backgroundBuild),
  ]);
  console.log("Build complete.");
}
