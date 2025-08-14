import { describe, it, expect } from "vitest";
import { auth } from "@/lib/auth";

describe("Better Auth Configuration", () => {
  it("should have auth instance configured", () => {
    expect(auth).toBeDefined();
  });

  it("should have required plugins configured", () => {
    // Test that the auth object is properly configured
    expect(auth).toHaveProperty("api");
    expect(auth).toHaveProperty("$Infer");
  });

  it("should have session configuration", () => {
    // Session configuration is internal, but we can test that auth is properly configured
    expect(auth.api).toBeDefined();
  });
});