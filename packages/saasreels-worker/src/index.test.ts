import test from "node:test";
import assert from "node:assert/strict";

import {
  claimNextLocalTask,
  enqueueLocalTask,
  resolveLocalQueuePaths,
  runWorkerLoop,
  runWorkerOnce,
} from "./index.js";

test("exports local queue and runner APIs from the package entrypoint", () => {
  assert.equal(typeof enqueueLocalTask, "function");
  assert.equal(typeof claimNextLocalTask, "function");
  assert.equal(typeof resolveLocalQueuePaths, "function");
  assert.equal(typeof runWorkerOnce, "function");
  assert.equal(typeof runWorkerLoop, "function");
});
