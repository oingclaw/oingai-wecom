#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function readJson(relPath) {
  const fullPath = path.join(root, relPath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function readText(relPath) {
  const fullPath = path.join(root, relPath);
  return fs.readFileSync(fullPath, "utf8");
}

function pickConstant(sourceText, constantName) {
  const pattern = new RegExp(`const\\s+${constantName}\\s*=\\s*"([^"]+)"`);
  const match = sourceText.match(pattern);
  return match ? match[1] : null;
}

const pkg = readJson("package.json");
const manifest = readJson("openclaw.plugin.json");
const source = readText("src/index.ts");

const issues = [];
const expectedMain = "dist/index.js";
const expectedTypes = "dist/index.d.ts";

if (pkg.name !== manifest.id) {
  issues.push(`package.json name (${pkg.name}) must match manifest id (${manifest.id}).`);
}

if (pkg.name !== manifest.name) {
  issues.push(`package.json name (${pkg.name}) must match manifest name (${manifest.name}).`);
}

if (pkg.version !== manifest.version) {
  issues.push(
    `package.json version (${pkg.version}) must match manifest version (${manifest.version}).`
  );
}

if (pkg.main !== expectedMain || manifest.main !== expectedMain) {
  issues.push(`main entry must be ${expectedMain} in both package.json and openclaw.plugin.json.`);
}

if (pkg.types !== expectedTypes) {
  issues.push(`package.json types must be ${expectedTypes}.`);
}

const extensionEntries = pkg.openclaw && Array.isArray(pkg.openclaw.extensions)
  ? pkg.openclaw.extensions
  : [];
if (!extensionEntries.includes("./dist/index.js")) {
  issues.push('package.json openclaw.extensions must include "./dist/index.js".');
}

const sourcePluginId = pickConstant(source, "PLUGIN_ID");
const sourceVersion = pickConstant(source, "VERSION");

if (!sourcePluginId) {
  issues.push("src/index.ts must define PLUGIN_ID as a string constant.");
} else if (sourcePluginId !== manifest.id) {
  issues.push(`src/index.ts PLUGIN_ID (${sourcePluginId}) must match manifest id (${manifest.id}).`);
}

if (!sourceVersion) {
  issues.push("src/index.ts must define VERSION as a string constant.");
} else if (sourceVersion !== manifest.version) {
  issues.push(`src/index.ts VERSION (${sourceVersion}) must match manifest version (${manifest.version}).`);
}

if (issues.length > 0) {
  console.error("Metadata validation failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      name: pkg.name,
      version: pkg.version,
      main: pkg.main,
      manifestId: manifest.id,
      manifestName: manifest.name,
    },
    null,
    2
  )
);
