#!/usr/bin/env node
"use strict";

const { createServer } = require("node:http");
const { randomUUID } = require("node:crypto");
const { readdir, readFile, rename, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");

const editorDirectory = __dirname;
const packsDirectory = path.resolve(__dirname, "..", "packs");
const port = Number(process.env.PORT || 3000);
const maxRequestBytes = 1024 * 1024;
const packNamePattern = /^[a-z0-9_]+$/;
const emojiNamePattern = /^[a-z0-9_]+$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function listEmojiNames(packName) {
  if (!packNamePattern.test(packName)) throw new HttpError(404, "Pack not found.");
  let entries;
  try {
    entries = await readdir(path.join(packsDirectory, packName, "emojis"), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") throw new HttpError(404, "Pack or emoji directory not found.");
    throw error;
  }
  return entries
    .filter(entry => entry.isFile() && /\.png$/i.test(entry.name))
    .map(entry => entry.name.replace(/\.png$/i, ""))
    .filter(name => emojiNamePattern.test(name))
    .sort((a, b) => a.localeCompare(b));
}

async function getPack(packName) {
  if (!packNamePattern.test(packName)) throw new HttpError(404, "Pack not found.");
  let metadata;
  try {
    metadata = await readJson(path.join(packsDirectory, packName, "pack.json"));
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") throw new HttpError(404, "Pack not found.");
    throw error;
  }
  const emojis = await listEmojiNames(packName);
  let transformations = {};
  try {
    transformations = await readJson(path.join(packsDirectory, packName, "transformations.json"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return {
    name: packName,
    title: typeof metadata.title === "string" && metadata.title ? metadata.title : packName,
    emojis,
    transformations
  };
}

async function listPacks() {
  const entries = await readdir(packsDirectory, { withFileTypes: true });
  const packs = await Promise.all(entries
    .filter(entry => entry.isDirectory() && packNamePattern.test(entry.name))
    .map(async entry => {
      const pack = await getPack(entry.name);
      return { name: pack.name, title: pack.title, emojiCount: pack.emojis.length };
    }));
  return packs.filter(pack => pack.emojiCount > 0).sort((a, b) => a.title.localeCompare(b.title));
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) throw new HttpError(413, "Request body is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function validateTransformations(value, emojis) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Transformations must be an object keyed by emoji name.");
  }
  const allowedFields = new Set(["x", "y", "r", "s"]);
  const validEmojis = new Set(emojis);
  const result = Object.create(null);

  for (const [name, transform] of Object.entries(value)) {
    if (!validEmojis.has(name)) throw new HttpError(400, `Unknown emoji: ${name}`);
    if (!transform || typeof transform !== "object" || Array.isArray(transform)) {
      throw new HttpError(400, `Transformation for ${name} must be an object.`);
    }
    for (const key of Object.keys(transform)) {
      if (!allowedFields.has(key)) throw new HttpError(400, `Unsupported transformation field: ${key}`);
    }
    const normalized = {};
    for (const [key, defaultValue] of [["x", 0], ["y", 0], ["r", 0], ["s", 1]]) {
      const fieldValue = Object.hasOwn(transform, key) ? transform[key] : defaultValue;
      if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
        throw new HttpError(400, `${name}.${key} must be a finite number.`);
      }
      if (key === "s" && fieldValue <= 0) throw new HttpError(400, `${name}.s must be greater than zero.`);
      if (fieldValue !== defaultValue) normalized[key] = fieldValue;
    }
    if (Object.keys(normalized).length) result[name] = normalized;
  }
  return result;
}

async function saveTransformations(packName, transformations) {
  const filePath = path.join(packsDirectory, packName, "transformations.json");
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(transformations, null, 2)}\n`, { flag: "wx" });
  try {
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url, "http://127.0.0.1");
  if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/" || url.pathname === "/index.html")) {
    const html = await readFile(path.join(editorDirectory, "index.html"));
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(request.method === "HEAD" ? undefined : html);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/packs") {
    sendJson(response, 200, { packs: await listPacks() });
    return;
  }

  const emojiMatch = url.pathname.match(/^\/api\/packs\/([^/]+)\/emojis\/([^/]+)\.png$/);
  if (request.method === "GET" && emojiMatch) {
    const [, packName, emojiName] = emojiMatch;
    if (!packNamePattern.test(packName) || !emojiNamePattern.test(emojiName)) throw new HttpError(404, "Emoji not found.");
    const emojis = await listEmojiNames(packName);
    if (!emojis.includes(emojiName)) throw new HttpError(404, "Emoji not found.");
    const image = await readFile(path.join(packsDirectory, packName, "emojis", `${emojiName}.png`));
    response.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(image);
    return;
  }

  const transformationsMatch = url.pathname.match(/^\/api\/packs\/([^/]+)\/transformations$/);
  if (request.method === "POST" && transformationsMatch) {
    const [, packName] = transformationsMatch;
    const pack = await getPack(packName);
    const body = await readRequestBody(request);
    const transformations = validateTransformations(body?.transformations, pack.emojis);
    await saveTransformations(packName, transformations);
    sendJson(response, 200, { transformations });
    return;
  }

  const packMatch = url.pathname.match(/^\/api\/packs\/([^/]+)$/);
  if (request.method === "GET" && packMatch) {
    sendJson(response, 200, await getPack(packMatch[1]));
    return;
  }

  throw new HttpError(404, "Not found.");
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch(error => {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error(error);
    if (!response.headersSent) sendJson(response, status, { error: status === 500 ? "The server could not complete the request." : error.message });
    else response.destroy(error);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Emoji Hat Transform Editor listening at http://127.0.0.1:${port}`);
});
