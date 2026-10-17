import { describe, expect, it } from "vitest";
import { productivityPrompt } from "./prompt";

describe("productivity prompt command boundaries", () => {
  it("separates WIMAX UI navigation from external provider commands", () => {
    expect(productivityPrompt).toContain("in-app UI commands");
    expect(productivityPrompt).toContain("must not mention Notion unless the user explicitly names Notion");
  });
});
