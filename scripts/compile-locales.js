import { Visitor as VisitorBase, parse } from "@fluent/syntax";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SourceNode } from "source-map";

const visitor = new (class Visitor extends VisitorBase {
  stack = [];
  vars = {};
  sources = {};
  path = "";
  source = "";

  process() {
    const nodes = [];
    const names = Object.keys(this.vars);
    for (const name of names) {
      const span = this.sources[name];
      if (this.vars[name].length > 0) {
        const args = this.vars[name].map((name) => `"${name}"`).join(" | ");
        const text = `  "${name}": Record<${args}, FluentVariable>;\n`;
        nodes.push(this.spanToSourceNode(span, text));
      } else {
        const text = `  "${name}": undefined;\n`;
        nodes.push(this.spanToSourceNode(span, text));
      }
    }
    return nodes;
  }

  spanToSourceNode(span, content) {
    return new SourceNode(
      this.source.slice(0, span.start).split("\n").length,
      0,
      this.path,
      content,
    );
  }

  visitMessage(node) {
    this.visitMessageOrAttribute(node);
  }

  visitAttribute(node) {
    this.visitMessageOrAttribute(node);
  }

  visitMessageOrAttribute(node) {
    this.stack.push(node.id.name);
    const path = this.stack.join(".");
    if (!this.vars[path]) this.vars[path] = [];
    this.sources[path] = node.span;
    this.genericVisit(node);
    this.stack.pop();
  }

  visitVariableReference(node) {
    const name = this.stack.join(".");
    if (!this.vars[name].includes(node.id.name)) {
      this.vars[name].push(node.id.name);
    }
  }
})();

const localesDir = resolve("locales");
for (const file of await readdir(localesDir)) {
  if (file.endsWith(".ftl")) {
    const source = (await readFile(resolve(localesDir, file))).toString();
    visitor.path = `../locales/${file}`;
    visitor.source = source;
    visitor.visit(parse(source));
  }
}

const node = new SourceNode(null, null, null, [
  "" +
    "// WARNING: DO NOT EDIT.\n" +
    "// This file was generated during the build process.\n" +
    "// Any changes made to it will be overridden.\n" +
    "\n" +
    'import { I18n as I18nBase, I18nFlavor as I18nFlavorBase } from "@grammyjs/i18n";\n' +
    "// @ts-ignore\n" +
    'import { type FluentVariable } from "@grammyjs/i18n/node_modules/@fluent/bundle/index.js";\n' +
    'import { Context, MiddlewareFn } from "grammy";\n' +
    "\n" +
    "export type Messages = {\n",
  ...visitor.process(),
  "" +
    "};\n" +
    "\n" +
    "// @ts-ignore\n" +
    "export interface I18nFlavor extends I18nFlavorBase {\n" +
    "  t<M extends keyof Messages>(\n" +
    "    key: M,\n" +
    "    ...args: Messages[M] extends undefined\n" +
    "      ? [args?: Record<string, FluentVariable>]\n" +
    "      : [args: Messages[M] & Record<string, FluentVariable>]\n" +
    "  ): string;\n" +
    "}\n" +
    "\n" +
    "export class I18n<C extends Context> extends I18nBase<C> {\n" +
    "  // @ts-ignore\n" +
    "  t<M extends keyof Messages>(\n" +
    "    locale: string,\n" +
    "    key: M,\n" +
    "    ...args: Messages[M] extends undefined\n" +
    "      ? [values?: Record<string, never>]\n" +
    "      : [values: Messages[M]]\n" +
    "  ): string;\n" +
    "  // @ts-ignore\n" +
    "  middleware(): MiddlewareFn<C>;\n" +
    "}\n" +
    "//# sourceMappingURL=_messages.ts.map",
]);

const { code, map } = node.toStringWithSourceMap({ file: "_messages.ts" });

await writeFile("src/_messages.ts", code);
await writeFile("src/_messages.ts.map", map.toString());
