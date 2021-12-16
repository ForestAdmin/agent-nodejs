import { BaseAction } from "../../src/implementations/action";
import { ActionResponseType } from "../../src/interfaces/action";

describe("Implementations > BaseAction", () => {
  it("should instanciate properly", () => {
    expect(new BaseAction()).toBeDefined();
  });

  describe("execute", () => {
    it("should resolve with an ErrorResponse", async () => {
      await expect(new BaseAction().execute({ value: 42 })).resolves.toMatchObject({
        type: ActionResponseType.Error,
        message: "Not implemented",
      });
    });
  });

  describe("getForm", () => {
    it("should resolve with an ActionForm", async () => {
      await expect(new BaseAction().getForm()).resolves.toMatchObject({
        fields: [],
      });
    });
  });
});
