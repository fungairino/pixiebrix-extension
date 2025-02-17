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

import { editorSlice } from "@/pageEditor/slices/editorSlice";
import { useDispatch, useSelector } from "react-redux";
import { useCallback } from "react";
import notify from "@/utils/notify";
import { getErrorMessage } from "@/errors/errorHelpers";
import { ADAPTERS } from "@/pageEditor/starterBricks/adapter";
import { reactivateEveryTab } from "@/background/messenger/api";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import { getLinkedApiClient } from "@/services/apiClient";
import { objToYaml } from "@/utils/objToYaml";
import { extensionWithInnerDefinitions } from "@/pageEditor/starterBricks/base";
import {
  useGetEditablePackagesQuery,
  useSaveStandaloneModDefinitionMutation,
} from "@/services/api";
import { type UnknownObject } from "@/types/objectTypes";
import extensionsSlice from "@/store/extensionsSlice";
import { selectSessionId } from "@/pageEditor/slices/sessionSelectors";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { isSingleObjectBadRequestError } from "@/errors/networkErrorHelpers";
import { ensureElementPermissionsFromUserGesture } from "@/pageEditor/editorPermissionsHelpers";
import { type Timestamp, type UUID } from "@/types/stringTypes";

import { isInnerDefinitionRegistryId } from "@/types/helpers";
import type { RegistryId } from "@/types/registryTypes";

const { saveModComponent } = extensionsSlice.actions;
const { markClean } = editorSlice.actions;

async function upsertPackageConfig(
  packageUUID: UUID | null,
  kind: "reader" | "extensionPoint",
  config: unknown,
): Promise<void> {
  const client = await getLinkedApiClient();

  const data = { config: objToYaml(config as UnknownObject), kind };

  if (packageUUID) {
    await client.put(`api/bricks/${packageUUID}/`, data);
  } else {
    await client.post("api/bricks/", data);
  }
}

function selectErrorMessage(error: unknown): string {
  // FIXME: should this logic be in getErrorMessage?
  if (isSingleObjectBadRequestError(error)) {
    return (
      // FIXME: won't the data on each property be an array?
      error.response?.data.config?.toString() ??
      error.response?.statusText ??
      "No response from PixieBrix server"
    );
  }

  return getErrorMessage(error);
}

type SaveOptions = {
  /**
   * True to save a copy of the ModComponentBase to the user's account
   */
  pushToCloud: boolean;
  /**
   * Should the permissions be checked before saving?
   */
  checkPermissions: boolean;
  /**
   * Should the user be notified of the save?
   */
  notifySuccess: boolean;
  /**
   * Should mods be reactivated on all tabs?
   */
  reactivateEveryTab: boolean;
};

/**
 * @param element the page editor formik state

 * @param checkPermissions
 * @returns errorMessage an error message, or null if no error occurred
 */
type SaveCallback = (config: {
  element: ModComponentFormState;
  options: SaveOptions;
  modId?: RegistryId;
}) => Promise<string | null>;

function onStepError(error: unknown, step: string): string {
  const message = selectErrorMessage(error);
  console.warn("Error %s: %s", step, message, { error });
  const errorMessage = `Error ${step}: ${message}`;
  notify.error({ message: errorMessage, error });

  return errorMessage;
}

/**
 * Hook that returns a callback to save a Mod Component Form State in Redux, and optionally push a Standalone Mod
 * Component to the cloud.
 */
function useUpsertModComponentFormState(): SaveCallback {
  // XXX: Some users have problems when saving from the Page Editor that seem to indicate the sequence of events doesn't
  //  occur in the correct order on slower (CPU or network?) machines. Therefore, await all promises. We also have to
  //  make `reactivate` behave deterministically if we're still having problems (right now it's implemented as a
  //  fire-and-forget notification).

  const dispatch = useDispatch();
  const sessionId = useSelector(selectSessionId);
  const { data: editablePackages } = useGetEditablePackagesQuery();
  const [saveStandaloneModDefinition] =
    useSaveStandaloneModDefinitionMutation();

  const saveElement = useCallback(
    async (
      element: ModComponentFormState,
      options: SaveOptions,
      modId?: RegistryId,
    ): Promise<string | null> => {
      if (options.checkPermissions) {
        // Good to prompt the creator for permissions if any is missing, but they're not actually required to save
        void ensureElementPermissionsFromUserGesture(element);
      }

      const adapter = ADAPTERS.get(element.type);

      const extensionPointId = element.extensionPoint.metadata.id;
      const hasInnerExtensionPoint =
        isInnerDefinitionRegistryId(extensionPointId);

      let isEditable = false;

      // Handle the case where the Page Editor is also editing an extension point that exists as a registry item
      if (!hasInnerExtensionPoint) {
        // PERFORMANCE: inefficient, grabbing all visible bricks prior to save. Not a big deal for now given
        // number of bricks implemented and frequency of saves
        isEditable = editablePackages.some((x) => x.name === extensionPointId);

        const isLocked = element.installed && !isEditable;

        if (!isLocked) {
          try {
            const extensionPointConfig =
              adapter.selectExtensionPointConfig(element);
            const packageId = element.installed
              ? editablePackages.find(
                  // Bricks endpoint uses "name" instead of id
                  (x) => x.name === extensionPointConfig.metadata.id,
                )?.id
              : null;

            await upsertPackageConfig(
              packageId,
              "extensionPoint",
              extensionPointConfig,
            );
          } catch (error) {
            return onStepError(error, "saving foundation");
          }
        }
      }

      reportEvent(Events.PAGE_EDITOR_MOD_COMPONENT_UPDATE, {
        sessionId,
        type: element.type,
        modId,
      });

      try {
        let modComponent = adapter.selectExtension(element);
        const updateTimestamp: Timestamp =
          new Date().toISOString() as Timestamp;

        if (hasInnerExtensionPoint) {
          const extensionPointConfig =
            adapter.selectExtensionPointConfig(element);
          modComponent = extensionWithInnerDefinitions(
            modComponent,
            extensionPointConfig.definition,
          );
        }

        dispatch(
          saveModComponent({
            modComponent: {
              ...modComponent,
              // Note that it is unfortunately the client's responsibility to make sure the `updateTimestamp` is the
              // same in Redux as it is on the server.
              updateTimestamp,
            },
          }),
        );

        if (options.pushToCloud && !modComponent._deployment) {
          await saveStandaloneModDefinition({
            modComponent: {
              ...modComponent,
              updateTimestamp,
            },
          }).unwrap();
        }

        dispatch(markClean(element.uuid));
      } catch (error) {
        return onStepError(error, "saving mod");
      }

      if (options.reactivateEveryTab) {
        reactivateEveryTab();
      }

      if (options.notifySuccess) {
        notify.success("Saved mod");
      }

      return null;
    },
    [dispatch, editablePackages, sessionId],
  );

  return useCallback(
    async ({ element, options, modId }) => {
      try {
        return await saveElement(element, options, modId);
      } catch (error) {
        console.error("Error saving mod", { error });
        notify.error({
          message: "Error saving mod",
          error,
        });
        return "Save error";
      }
    },
    [saveElement],
  );
}

export default useUpsertModComponentFormState;
