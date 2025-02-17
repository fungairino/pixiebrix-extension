/*
 * Copyright (C) 2023 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { type JsonObject } from "type-fest";
import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { sortBy } from "lodash";
import { type BrickConfig } from "@/bricks/types";
import objectHash from "object-hash";
import { type ErrorObject } from "serialize-error";
import { type UUID } from "@/types/stringTypes";
import { type RegistryId } from "@/types/registryTypes";
import {
  type Branch,
  type OutputKey,
  type RenderedArgs,
} from "@/types/runtimeTypes";
import { deleteDatabase } from "@/utils/idbUtils";

const DATABASE_NAME = "TRACE";
const ENTRY_OBJECT_STORE = "traces";
const DB_VERSION_NUMBER = 3;

export type TraceRecordMeta = {
  /**
   * Extension id, to correlate across extension runs.
   *
   * `null` for ad-hoc block execution.
   */
  extensionId: UUID | null;

  /**
   * Extension run id. Unique run id to correlate trace elements from the same extension run.
   */
  runId: UUID;

  /**
   * Branches to the brick execution
   *
   * Currently, two kinds of branches tracked
   * 1. defer
   * 2. pipeline (e.g., in if/else, document builder button, etc.)
   *
   * @since 1.7.0
   */
  branches: Branch[];

  /**
   * Unique id to identify the block in the Page Editor across runs.
   */
  blockInstanceId: UUID;

  /**
   * The registry id of the block.
   */
  blockId: RegistryId;
};

type Output = {
  outputKey: OutputKey | null;

  /**
   * Output of the block
   */
  output: JsonObject | null;
};

type ErrorOutput = {
  /**
   * Serialized error from running the block
   */
  error: ErrorObject;
};

/**
 *
 */
export type TraceEntryData = TraceRecordMeta & {
  /**
   * ISO timestamp when the trace element was recorded.
   */
  timestamp: string;

  templateContext: JsonObject;

  /**
   * The rendered args, or null if there was an error rendering the args
   */
  renderedArgs: RenderedArgs | null;

  /**
   * The error rendering the arguments
   */
  renderError: ErrorObject | null;

  blockConfig: BrickConfig;
};

export type TraceExitData = TraceRecordMeta &
  (Output | ErrorOutput) & {
    /**
     * If a condition was specified and not met, this is `true`, otherwise `false`.
     */
    skippedRun: boolean;

    /**
     * `true` if the brick was skipped or finished running. Introduced to avoid gotchas with effect bricks which
     * produce a null/undefined result.
     * @since 1.7.0
     */
    isFinal: boolean;

    /**
     * `true` if the exit is because the result will run in the renderer
     * @since 1.7.0
     */
    isRenderer: boolean;
  };

type DerivedData = {
  /**
   * Unique identifier to distinguish calls to the same static brick in the same run
   * @since 1.7.0
   */
  callId: string;
};

export type TraceRecord = TraceEntryData & Partial<TraceExitData> & DerivedData;

export type TraceError = TraceEntryData & ErrorOutput & DerivedData;

export function isTraceError(
  traceRecord: TraceRecord,
): traceRecord is TraceError {
  return "error" in traceRecord && traceRecord.error != null;
}

const INDEX_KEYS = [
  "runId",
  "blockInstanceId",
  "extensionId",
] as const satisfies Array<keyof TraceRecordMeta>;

interface TraceDB extends DBSchema {
  [ENTRY_OBJECT_STORE]: {
    value: TraceRecord;
    key: string;
    indexes: {
      runId: UUID;
      blockInstanceId: UUID;
      extensionId: UUID;
    };
  };
}

async function openTraceDB() {
  // Always return a new DB connection. IDB performance seems to be better than reusing the same connection.
  // https://stackoverflow.com/questions/21418954/is-it-bad-to-open-several-database-connections-in-indexeddb
  let database: IDBPDatabase<TraceDB> | null = null;

  database = await openDB<TraceDB>(DATABASE_NAME, DB_VERSION_NUMBER, {
    upgrade(db) {
      try {
        // For now, just clear local logs whenever we need to upgrade the log database structure. There's no real use
        // cases for looking at historic local logs
        db.deleteObjectStore(ENTRY_OBJECT_STORE);
        console.warn(
          "Deleting object store %s for upgrade",
          ENTRY_OBJECT_STORE,
        );
      } catch {
        // Not sure what will happen if the store doesn't exist (i.e., on initial install, so just NOP it)
      }

      // Create a store of objects
      const store = db.createObjectStore(ENTRY_OBJECT_STORE, {
        keyPath: ["runId", "blockInstanceId", "callId"],
      });

      // Create individual indexes
      for (const indexKey of INDEX_KEYS) {
        store.createIndex(indexKey, indexKey, {
          unique: false,
        });
      }
    },
    blocking() {
      // Don't block closing/upgrading the database
      console.debug("Closing trace database due to upgrade/delete");
      database?.close();
      database = null;
    },
    terminated() {
      console.debug("Trace database connection was unexpectedly terminated");
      database = null;
    },
  });

  database.addEventListener("close", () => {
    database = null;
  });

  return database;
}

export async function addTraceEntry(record: TraceEntryData): Promise<void> {
  if (!record.runId) {
    console.debug("Ignoring trace entry data without runId");
    return;
  }

  if (!record.blockInstanceId) {
    console.debug("Ignoring trace entry data without blockInstanceId");
    return;
  }

  const db = await openTraceDB();
  try {
    const callId = objectHash(record.branches);
    await db.add(ENTRY_OBJECT_STORE, { ...record, callId });
  } finally {
    db.close();
  }
}

export async function addTraceExit(record: TraceExitData): Promise<void> {
  if (!record.runId) {
    console.debug("Ignoring trace exit data without runId");
    return;
  }

  if (!record.blockInstanceId) {
    console.debug("Ignoring trace exit data without blockInstanceId");
    return;
  }

  const callId = objectHash(record.branches);

  const db = await openTraceDB();

  try {
    const tx = db.transaction(ENTRY_OBJECT_STORE, "readwrite");

    const data = await tx.store.get(
      IDBKeyRange.only([record.runId, record.blockInstanceId, callId]),
    );

    if (data) {
      await tx.store.put({
        ...data,
        ...record,
        callId,
      });
    } else {
      console.warn("Trace entry record not found", {
        runId: record.runId,
        blockInstanceId: record.blockInstanceId,
        callId,
      });
    }
  } finally {
    db.close();
  }
}

/**
 * Clear all trace records.
 */
export async function clearTraces(): Promise<void> {
  const db = await openTraceDB();
  try {
    await db.clear(ENTRY_OBJECT_STORE);
  } finally {
    db.close();
  }
}

/**
 * Returns the number of trace records in the database.
 */
export async function count(): Promise<number> {
  const db = await openTraceDB();
  try {
    return await db.count(ENTRY_OBJECT_STORE);
  } finally {
    db.close();
  }
}

/**
 * Deletes and recreates the trace database.
 */
export async function recreateDB(): Promise<void> {
  // Delete the database and open the database to recreate it
  await deleteDatabase(DATABASE_NAME);
  const db = await openTraceDB();
  db.close();
}

export async function clearExtensionTraces(extensionId: UUID): Promise<void> {
  let cnt = 0;

  const db = await openTraceDB();

  try {
    const tx = db.transaction(ENTRY_OBJECT_STORE, "readwrite");
    const index = tx.store.index("extensionId");
    for await (const cursor of index.iterate(extensionId)) {
      cnt++;
      await cursor.delete();
    }

    console.debug(
      "Cleared %d trace entries for extension %s",
      cnt,
      extensionId,
    );
  } finally {
    db.close();
  }
}

export async function getLatestRunByExtensionId(
  extensionId: UUID,
): Promise<TraceRecord[]> {
  const db = await openTraceDB();

  try {
    const matches = await db
      .transaction(ENTRY_OBJECT_STORE, "readonly")
      .objectStore(ENTRY_OBJECT_STORE)
      .index("extensionId")
      .getAll(extensionId);

    // Use both reverse and sortBy because we want insertion order if there's a tie in the timestamp
    const sorted = sortBy(
      matches.reverse(),
      (x) => -new Date(x.timestamp).getTime(),
    );

    const runId = sorted[0]?.runId;
    if (runId) {
      return sorted.filter((x) => x.runId === runId);
    }

    return [];
  } finally {
    db.close();
  }
}
