import { Visitor as VisitorBase, parse } from "@fluent/syntax";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const visitor = new (class Visitor extends VisitorBase {
  stack = [];
  vars = {};

  process() {
    const names = Object.keys(this.vars);
    names.sort();

    for (const name of names) {
      if (this.vars[name].length > 0) {
        const args = this.vars[name].map((name) => `"${name}"`).join(" | ");
        console.log(`  "${name}": Record<${args}, FluentVariable>;`);
      } else {
        console.log(`  "${name}": undefined;`);
      }
    }
  }

  visitMessage(node) {
    this.stack.push(node.id.name);
    this.vars[this.stack.join(".")] = [];
    this.genericVisit(node);
    this.stack.pop();
  }

  visitAttribute(node) {
    this.stack.push(node.id.name);
    this.vars[this.stack.join(".")] = [];
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

const path = resolve("locales");
const files = await readdir(path);
for (const file of files) {
  if (file.endsWith(".ftl")) {
    const source = await readFile(resolve(path, file));
    visitor.visit(parse(source.toString()));
  }
}

console.log(
  "" +
    "// WARNING: DO NOT EDIT.\n" +
    "// This file was generated during the build process.\n" +
    "// Any changes made to it will be overridden.\n" +
    "\n" +
    'import { I18n as I18nBase, I18nFlavor as I18nFlavorBase } from "@grammyjs/i18n";\n' +
    "// @ts-ignore\n" +
    'import { type FluentVariable } from "@grammyjs/i18n/node_modules/@fluent/bundle/index.js";\n' +
    'import { Context, MiddlewareFn } from "grammy";' +
    "\n" +
    "export type Messages = {",
);
visitor.process();
console.log(
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
    "      ? [values?: Record<string, FluentVariable>]\n" +
    "      : [values: Messages[M] & Record<string, FluentVariable>]\n" +
    "  ): string;\n" +
    "  // @ts-ignore\n" +
    "  middleware(): MiddlewareFn<C>;\n" +
    "}",
);
