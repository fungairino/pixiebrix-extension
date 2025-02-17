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

import { type MigrationManifest, type PersistedState } from "redux-persist";
import { type Except } from "type-fest";
import { type EditorState } from "@/pageEditor/pageEditorTypes";
import { isEmpty, mapValues, omit } from "lodash";
import {
  type BaseFormStateV1,
  type BaseFormStateV2,
} from "@/pageEditor/baseFormStateTypes";
import {
  type IntegrationDependencyV1,
  type IntegrationDependencyV2,
} from "@/integrations/integrationTypes";

/**
 * @deprecated - Do not use versioned state types directly, exported for testing
 */
export type PersistedEditorStateV1 = PersistedState &
  Except<EditorState, "elements" | "deletedElementsByRecipeId"> & {
    elements: BaseFormStateV1[];
    deletedElementsByRecipeId: Record<string, BaseFormStateV1[]>;
  };

/**
 * @deprecated - Do not use versioned state types directly, exported for testing
 */
export type PersistedEditorStateV2 = PersistedState &
  Except<EditorState, "elements" | "deletedElementsByRecipeId"> & {
    elements: BaseFormStateV2[];
    deletedElementsByRecipeId: Record<string, BaseFormStateV2[]>;
  };

export const migrations: MigrationManifest = {
  // Redux-persist defaults to version: -1; Initialize to positive-1-indexed
  // state version to match state type names
  0: (state) => state,
  1: (state) => state,
  2: (state: PersistedEditorStateV1) => migrateEditorStateV1(state),
};

export function migrateIntegrationDependenciesV1toV2(
  services: IntegrationDependencyV1[],
): IntegrationDependencyV2[] {
  if (isEmpty(services)) {
    return [];
  }

  return services.map((dependency) => ({
    integrationId: dependency.id,
    outputKey: dependency.outputKey,
    configId: dependency.config,
    isOptional: dependency.isOptional,
    apiVersion: dependency.apiVersion,
  }));
}

function migrateFormStateV1(state: BaseFormStateV1): BaseFormStateV2 {
  return {
    ...omit(state, "services"),
    integrationDependencies: migrateIntegrationDependenciesV1toV2(
      state.services,
    ),
  };
}

export function migrateEditorStateV1(
  state: PersistedEditorStateV1,
): PersistedEditorStateV2 {
  return {
    ...state,
    elements: state.elements.map((formState) => migrateFormStateV1(formState)),
    deletedElementsByRecipeId: mapValues(
      state.deletedElementsByRecipeId,
      (formStates) =>
        formStates.map((formState) => migrateFormStateV1(formState)),
    ),
  };
}
