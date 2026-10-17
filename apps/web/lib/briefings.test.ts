import { describe, expect, it } from "vitest";
import { previousWeek } from "./briefings";

describe("previousWeek", () => {
  it("returns the completed Monday to Sunday window", () => {
    expect(previousWeek(new Date("2026-08-24T08:00:00Z"))).toEqual({ start: "2026-08-17", end: "2026-08-23" });
  });
});

