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

import { mapValues } from "lodash";
import { type Reader, ReaderABC } from "@/types/bricks/readerTypes";
import { type JsonObject } from "type-fest";

class CompositeReader extends ReaderABC {
  private readonly _readers: Record<string, Reader>;

  constructor(readers: Record<string, Reader>) {
    super(
      "@pixiebrix/composite-reader",
      "Composite Reader",
      "Combination of multiple readers",
    );
    this._readers = readers;
    this.outputSchema = {
      $schema: "https://json-schema.org/draft/2019-09/schema#",
      type: "object",
      properties: mapValues(this._readers, (x) => x.outputSchema),
      required: Object.keys(this._readers),
    };
  }

  async isAvailable(): Promise<boolean> {
    const readerArray = Object.values(this._readers);
    // PERFORMANCE: could return quicker if any came back false using Promise.any
    const availability = await Promise.all(
      readerArray.map(async (x) => x.isAvailable()),
    );
    return availability.every(Boolean);
  }

  override async isPure(): Promise<boolean> {
    const readerArray = Object.values(this._readers);
    // PERFORMANCE: could return quicker if any came back false using Promise.any
    const purity = await Promise.all(readerArray.map(async (x) => x.isPure()));
    return purity.every(Boolean);
  }

  override async isRootAware(): Promise<boolean> {
    const readerArray = Object.values(this._readers);
    // PERFORMANCE: could return quicker if any came back true using Promise.any
    const awareness = await Promise.all(
      readerArray.map(async (x) => x.isRootAware()),
    );
    return awareness.some(Boolean);
  }

  async read(root: HTMLElement | Document): Promise<JsonObject> {
    const readOne = async (key: string, reader: Reader) => [
      key,
      await reader.read(root),
    ];
    const resultPairs = await Promise.all(
      Object.entries(this._readers).map(async ([key, reader]) =>
        readOne(key, reader),
      ),
    );
    return Object.fromEntries(resultPairs);
  }
}

export default CompositeReader;
