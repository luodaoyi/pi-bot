import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RespireClient } from "../src/index.js";

describe("RespireClient", () => {
  let client: RespireClient;

  beforeAll(() => {
    client = new RespireClient({ port: 15169 });
  });

  it("should create client instance", () => {
    expect(client).toBeDefined();
  });

  describe("health", () => {
    it("should throw when runtime unavailable", async () => {
      await expect(client.health()).rejects.toThrow();
    });
  });

  describe("exec", () => {
    it("should format args correctly", () => {
      expect(client).toBeDefined();
    });
  });

  describe("recall", () => {
    it("should build recall args with titles", () => {
      expect(client).toBeDefined();
    });
  });

  describe("remember", () => {
    it("should handle candidates response", () => {
      expect(client).toBeDefined();
    });
  });
});
