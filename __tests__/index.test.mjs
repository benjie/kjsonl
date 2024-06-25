// @ts-check

import * as assert from "node:assert";
import { describe, it, before, after } from "node:test";

import { KJSONLGetter } from "../dist/index.js";

const __dirname = new URL(".", import.meta.url).pathname;

describe("KJSONLGetter", async () => {
  /** @type {KJSONLGetter} */
  let getter;
  before(() => {
    getter = new KJSONLGetter(`${__dirname}/sample.kjsonl`);
  });
  after(async () => {
    await getter.release();
  });

  it("can read a key that exists", async () => {
    const value = await getter.get("simple_key");
    assert.equal(value, "123");
  });
  it("can read a key that exists and needs escaping", async () => {
    const value = await getter.get('"');
    assert.equal(value, "321");
  });

  it("doesn't get confused when a key doesn't exist", async () => {
    const value = await getter.get("nxkey");
    assert.equal(value, undefined);
  });

  it("doesn't get confused when an escaped key doesn't exist", async () => {
    const value = await getter.get('nx"key');
    assert.equal(value, undefined);
  });

  it("can read a key that exists, again", () => {
    // Note: not awaiting this because we want to test that the runloop tick
    // isn't necessary when it's already cached
    const value = getter.get("simple_key");
    assert.equal(value, "123");
  });
});
