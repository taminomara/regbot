import { describe, expect, test } from "@jest/globals";

import { simpleTemplate } from "./event.js";

describe("template engine", () => {
  test("handles double braces", () => {
    expect(simpleTemplate("foo {{ bar }}", { bar: "XXX" })).toBe("foo { bar }");
  });
});

describe("template engine", () => {
  test("handles string variables", () => {
    expect(simpleTemplate("foo { bar }", { bar: "XXX" })).toBe("foo XXX");
  });
});
