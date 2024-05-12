import path from "node:path";
import fs from "node:fs/promises";

import swc from "@swc/core";
import postcss from "postcss";

import atImport from "postcss-import";
import tailwindcssNesting from "tailwindcss/nesting/index.js";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import postcssRemapper from "./postcss-remapper/index.js";

// @ts-ignore
export type ClassMap = Record<string, string | ClassMap>;

export class Transpiler {
   public constructor(private classmap: ClassMap) {}

   public async js(file: string) {
      const dest = file.replace(/\.[^\.]+$/, ".js");
      const buffer = await fs.readFile(file, "utf-8");
      const { code } = await swc.transform(buffer, {
         filename: file,
         isModule: true,
         jsc: {
            baseUrl: ".",
            experimental: {
               plugins: [
                  [import.meta.resolve("swc-remapper").slice(8), { classmap: { CLASSMAP: this.classmap } }],
               ],
            },
            parser: {
               syntax: "typescript",
               tsx: true,
               decorators: true,
               dynamicImport: true,
            },
            target: "esnext",
            transform: {
               decoratorVersion: "2022-03",
               react: {
                  pragma: "React.createElement",
                  pragmaFrag: "React.Fragment",
               },
            },
            loose: false,
         },
         outputPath: dest,
         sourceMaps: false,
      });
      await fs.writeFile(dest, code);
   }

   public async css(file: string, moduleFiles: string[]) {
      const dest = file.replace(/\.[^\.]+$/, ".css");
      const buffer = await fs.readFile(file, "utf-8");
      const PostCSSProcessor = await postcss.default([
         atImport(),
         tailwindcssNesting(),
         tailwindcss({
            config: {
               content: {
                  relative: true,
                  files: moduleFiles,
               },
            },
         }),
         autoprefixer({}),
         postcssRemapper({ classmap: this.classmap }),
      ]);
      const p = await PostCSSProcessor.process(buffer, { from: file });
      await fs.writeFile(dest, p.css);
   }
}
