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

import { PropError } from "@/errors/businessErrors";
import { type SelectorRoot } from "@/types/runtimeTypes";
import { type RegistryId } from "@/types/registryTypes";
import { $safeFind } from "@/utils/domUtils";

/**
 * Special prop used to upgrade DOM bricks to be root-aware
 * @since 1.7.16
 */
export const IS_ROOT_AWARE_BRICK_PROPS = Object.freeze({
  isRootAware: {
    description:
      "Whether the brick should run in the context of the target element, or document",
    type: "boolean",
    // `default: true` only impacts the default the Page Editor supplies. It doesn't impact the
    // behavior of the runtime/bricks.
    default: true,
  },
} as const);

/**
 * Return JQuery elements for use in a brick.
 * @param selector the selector
 * @param selectorProp the name of the selector prop, used in PropError message
 * @param root the current root
 * @param isRootAware `true` if the root should be used to compute the element
 * @param blockId the registry id of the block, used in PropError message
 *
 * @see $safeFind
 */
export function $safeFindElementsWithRootMode({
  selector,
  selectorProp = "selector",
  root,
  isRootAware = false,
  blockId,
}: {
  selector?: string;
  root: SelectorRoot;
  isRootAware?: boolean;
  blockId: RegistryId;
  selectorProp?: string;
}): JQuery<HTMLElement | Document> {
  if (isRootAware) {
    if (!selector) {
      return $(root);
    }

    return $safeFind(selector, root);
  }

  if (!selector) {
    throw new PropError(
      "Selector is required",
      blockId,
      selectorProp,
      selector,
    );
  }

  return $safeFind(selector, document);
}
