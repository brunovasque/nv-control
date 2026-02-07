import { promises as fs } from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), ".orchestrator-db.json");

let memoryDb = {
  workflows: {},
  executions: {},
  flags: {}
};

async function readDiskDb() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      workflows: parsed.workflows || {},
      executions: parsed.executions || {},
      flags: parsed.flags || {}
    };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { ...memoryDb };
    }

    return { ...memoryDb };
  }
}

async function writeDiskDb(db) {
  memoryDb = db;

  try {
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // Ambiente read-only: mantém persistência em memória.
  }
}

export async function getDb() {
  const db = await readDiskDb();
  memoryDb = db;
  return db;
}

export async function updateDb(updater) {
  const db = await getDb();
  const next = await updater(db);
  await writeDiskDb(next);
  return next;
}

export async function saveWorkflow(workflow) {
  return updateDb((db) => ({
    ...db,
    workflows: {
      ...db.workflows,
      [workflow.workflow_id]: workflow
    }
  }));
}

export async function getWorkflow(workflowId) {
  const db = await getDb();
  return db.workflows[workflowId] || null;
}

export async function saveExecution(execution) {
  return updateDb((db) => ({
    ...db,
    executions: {
      ...db.executions,
      [execution.execution_id]: execution
    }
  }));
}

export async function getExecution(executionId) {
  const db = await getDb();
  return db.executions[executionId] || null;
}

export async function setFlag(key, value) {
  return updateDb((db) => ({
    ...db,
    flags: {
      ...db.flags,
      [key]: value
    }
  }));
}

export async function getFlag(key) {
  const db = await getDb();
  return db.flags[key];
}
