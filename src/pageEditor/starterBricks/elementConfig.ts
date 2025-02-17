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

import type React from "react";
import { type IconProp } from "@fortawesome/fontawesome-svg-core";
import { type Metadata } from "@/types/registryTypes";
import { type StarterBrickConfig } from "@/starterBricks/types";
import { type StarterBrickType } from "@/types/starterBrickTypes";
import type { DynamicDefinition } from "@/contentScript/pageEditor/types";
import { type ModComponentBase } from "@/types/modComponentTypes";
import { type Target } from "@/types/messengerTypes";
import { type BaseFormState } from "@/pageEditor/baseFormStateTypes";

/**
 * ExtensionPoint configuration for use with the Page Editor.
 */
export interface ElementConfig<
  TResult = unknown,
  TState extends BaseFormState = BaseFormState,
> {
  /**
   * The internal element type, e.g., menuItem, contextMenu, etc.
   */
  readonly elementType: StarterBrickType;

  /**
   * The StarterBrickConfig class corresponding to the extension point
   * @see StarterBrickConfig
   */
  // eslint-disable-next-line @typescript-eslint/ban-types -- we want to Ctor here for the extension point
  readonly baseClass: Function;

  readonly EditorNode?: React.ComponentType<{ isLocked: boolean }>;

  /**
   * Order to display this element in the new element dropdown in the sidebar
   */
  readonly displayOrder: number;

  /**
   * The human-friendly name to refer to the element type (e.g., Context Menu)
   */
  readonly label: string;

  /**
   * FontAwesome icon representing the element type
   */
  readonly icon: IconProp;

  /**
   * Feature flag that indicates whether the element type is enabled for the user. `undefined` to indicate
   * all users should be able to create/edit the elements of this type.
   */
  readonly flag?: string;

  /**
   * Method for the user to select an element from the host page (e.g., placing a menu button).
   * `undefined` for elements that aren't placed natively in the host page (e.g., context menus)
   * @param target the tab on which to run the function
   */
  readonly selectNativeElement?: (
    target: Target,
    useNewFilter?: boolean,
  ) => Promise<TResult>;

  /**
   * Returns the initial page editor form state for a new element (including new foundation)
   * @param url the URL of the current page
   * @param metadata the initial metadata for the new element
   * @param element the result of the `insert` method
   *
   * @see fromExtensionPoint
   */
  readonly fromNativeElement: (
    url: string,
    metadata: Metadata,
    element: TResult,
  ) => TState;

  /**
   * Returns a dynamic element definition that the content script can render on the page
   */
  readonly asDynamicElement: (state: TState) => DynamicDefinition;

  /**
   * Returns the FormState corresponding to extension
   */
  readonly fromExtension: (extension: ModComponentBase) => Promise<TState>;

  /**
   * Returns the extension point configuration corresponding to the FormState.
   */
  readonly selectExtensionPointConfig: (element: TState) => StarterBrickConfig;

  /**
   * Returns the extension configuration corresponding to the FormState.
   *
   * NOTE: If the extension uses an innerDefinition for the extension point, the extensionPointId will point to the
   * temporary `@inner/` RegistryId generated by the Page Editor.
   *
   * @see isInnerExtensionPoint
   * @see extensionWithInnerDefinitions
   */
  readonly selectExtension: (element: TState) => ModComponentBase;
}
