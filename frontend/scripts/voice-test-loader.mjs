// Reuse the installed TypeScript compiler and Node runner; no app bundler needed.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(new URL("../package.json", import.meta.url));

export function sourceLoader(overrides = {}) {
  const cache = new Map();
  function load(relative) {
    let filename = path.resolve(frontendRoot, relative);
    if (!path.extname(filename)) {
      filename = [filename + ".ts", filename + ".tsx", path.join(filename, "index.tsx")].find(fs.existsSync);
    }
    if (!filename) throw new Error(`Cannot resolve test source ${relative}`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const runtimeModule = { exports: {} };
    cache.set(filename, runtimeModule);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const require = (specifier) => {
      if (specifier in overrides) return overrides[specifier];
      if (specifier.startsWith("@/")) return load(specifier.slice(2));
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), specifier));
      return nativeRequire(specifier);
    };
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(require, runtimeModule, runtimeModule.exports);
    return runtimeModule.exports;
  }
  return load;
}
