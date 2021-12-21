import { FieldTypes, PrimitiveTypes } from "../src";

describe("definitions", () => {
  describe("FieldTypes", () => {
    it("should be defined", () => {
      expect(FieldTypes).toBeDefined();
    });
  });

  describe("PrimitiveTypes", () => {
    it("should be defined", () => {
      expect(PrimitiveTypes).toBeDefined();
    });
  });
});
