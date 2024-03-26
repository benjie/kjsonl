// @ts-check

import * as assert from "node:assert";
import { it } from "node:test";

import { KJSONLGetter } from "../dist/index.js";

const __dirname = new URL(".", import.meta.url).pathname;

it("can read a key that exists", async () => {
  const getter = new KJSONLGetter(`${__dirname}/sample.kjsonl`);
  const value = await getter.get("simple_key");
  assert.equal(value, "123");
});

it("can read a key that exists and needs escaping", async () => {
  const getter = new KJSONLGetter(`${__dirname}/sample.kjsonl`);
  const value = await getter.get('"');
  assert.equal(value, "321");
});

it("doesn't get confused when a key doesn't exist", async () => {
  const getter = new KJSONLGetter(`${__dirname}/sample.kjsonl`);
  {
    const value = await getter.get("nxkey");
    assert.equal(value, undefined);
  }
  {
    const value = await getter.get('nx"key');
    assert.equal(value, undefined);
  }
});
