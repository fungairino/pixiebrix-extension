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

import { type Dispatch } from "react";
import {
  removeDynamicElements,
  removeDynamicElementsForRecipe,
} from "@/store/editorStorage";
import { actions as extensionActions } from "@/store/extensionsSlice";
import { removeExtensionForEveryTab } from "@/background/messenger/api";
import { uniq } from "lodash";
import { type UnresolvedModComponent } from "@/types/modComponentTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type UUID } from "@/types/stringTypes";

/**
 * Use this helper outside the Page Editor context to uninstall a recipe and all of its extensions.
 *
 * Uninstalls from:
 * - Extension Options slice
 * - Dynamic Elements slice (i.e., Page Editor state)
 * - Notifies all tabs to remove the extensions
 */
export async function uninstallRecipe(
  recipeId: RegistryId,
  recipeExtensions: UnresolvedModComponent[],
  dispatch: Dispatch<unknown>,
): Promise<void> {
  const dynamicElementsToUninstall =
    await removeDynamicElementsForRecipe(recipeId);

  dispatch(extensionActions.removeRecipeById(recipeId));

  removeExtensionsFromAllTabs(
    uniq([
      ...recipeExtensions.map(({ id }) => id),
      ...dynamicElementsToUninstall,
    ]),
  );
}

/**
 * Use this helper outside the Page Editor context
 * to uninstall a collections of extensions.
 */
export async function uninstallExtensions(
  extensionIds: UUID[],
  dispatch: Dispatch<unknown>,
): Promise<void> {
  await removeDynamicElements(extensionIds);

  dispatch(extensionActions.removeExtensions({ extensionIds }));

  removeExtensionsFromAllTabs(extensionIds);
}

/**
 * Uninstalls the extensions from all open tabs
 */
export function removeExtensionsFromAllTabs(extensionIds: UUID[]): void {
  for (const extensionId of extensionIds) {
    removeExtensionForEveryTab(extensionId);
  }
}
