import { expect } from "chai";
import { getKeyForImage, getParamsFromKey } from "../src/crud";

const params1 = {
  format: "png",
  width: 100,
  height: 100,
  quality: 100,
  fit: "cover",
  pos: "center",
  bg: "rgba(0,0,0,0)",
  kernel: "nearest",
  progressive: true,
  palette: true,
  dither: 0.5,
} as const;
const key1 =
  "test/image-id_bg:rgba(0,0,0,0)-dither:0.5-fit:cover-height:100-kernel:nearest-palette:true-pos:center-progressive:true-quality:100-width:100.png";

describe("crud", () => {
  describe("getKeyForImage", () => {
    it("returns the correct key for an image based on its parameters, #1", () => {
      const key = getKeyForImage("test", "image-id", params1);

      expect(key).to.equal(key1);
    });
  });

  describe("getParamsFromKey", () => {
    it("returns the correct params for an image based on its key, #1", () => {
      const params = getParamsFromKey(key1);

      expect(params).to.deep.equal(params1);
    });
  });
});
