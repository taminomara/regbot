import { describe, expect, test } from "@jest/globals";

import { redactBotToken } from "./redact.js";

const token = "123456:SECRET-abc_DEF";

describe("redactBotToken", () => {
  test("redacts token in a URL", () => {
    expect(
      redactBotToken(`https://api.telegram.org/bot${token}/getMe`, token),
    ).toBe("https://api.telegram.org/bot123456:***/getMe");
  });

  test("redacts all occurrences", () => {
    expect(redactBotToken(`${token} and ${token}`, token)).toBe(
      "123456:*** and 123456:***",
    );
  });

  test("leaves line unchanged when token is empty", () => {
    expect(redactBotToken("hello", "")).toBe("hello");
  });

  test("leaves line without token unchanged", () => {
    expect(redactBotToken("hello", token)).toBe("hello");
  });
});
