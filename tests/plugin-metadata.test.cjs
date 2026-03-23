"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const manifest = require("../openclaw.plugin.json");
const pluginModule = require("../dist/index.js");

const plugin = pluginModule.default || pluginModule;

test("plugin exports match manifest identity", () => {
  assert.equal(plugin.id, manifest.id);
  assert.equal(plugin.version, manifest.version);
  assert.equal(typeof plugin.register, "function");
});
