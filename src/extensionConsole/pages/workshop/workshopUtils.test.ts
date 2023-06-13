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

import { getKindDisplayName } from "@/extensionConsole/pages/workshop/workshopUtils";
import { type EditablePackage } from "@/types/contract";

describe("getKindDisplayName", () => {
  it.each(["block", "Block", "reader"])(
    "maps %s to Brick",
    (kind: EditablePackage["kind"]) => {
      expect(getKindDisplayName(kind)).toEqual("Brick");
    }
  );

  it.each(["recipe", "Recipe", "blueprint"])(
    "maps %s to Mod",
    (kind: EditablePackage["kind"]) => {
      expect(getKindDisplayName(kind)).toEqual("Mod");
    }
  );
});
