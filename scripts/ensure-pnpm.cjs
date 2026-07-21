"use strict";

const fs = require("node:fs");

for (const file of ["package-lock.json", "yarn.lock"]) {
  try {
    fs.unlinkSync(file);
  } catch {
    // ignore missing files
  }
}

const ua = process.env.npm_config_user_agent || "";
if (!ua.includes("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
