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

import { useCallback } from "react";
import { type RegistryId } from "@/types/registryTypes";
import {
  DEACTIVATE_MOD_MODAL_PROPS,
  useRemoveModComponentFromStorage,
} from "@/pageEditor/hooks/useRemoveModComponentFromStorage";
import { useDispatch, useSelector } from "react-redux";
import { selectExtensions } from "@/store/extensionsSelectors";
import { selectElements } from "@/pageEditor/slices/editorSelectors";
import { uniq } from "lodash";
import { useModals } from "@/components/ConfirmationModal";
import { actions } from "@/pageEditor/slices/editorSlice";
import { getIdForElement, getModIdForElement } from "@/pageEditor/utils";
import { clearLog } from "@/background/messenger/api";

type Config = {
  modId: RegistryId;
  shouldShowConfirmation?: boolean;
};

/**
 * This hook provides a callback function to deactivate a mod and remove it from the Page Editor
 */
function useDeactivateMod(): (useDeactivateConfig: Config) => Promise<void> {
  const dispatch = useDispatch();
  const removeModComponentFromStorage = useRemoveModComponentFromStorage();
  const extensions = useSelector(selectExtensions);
  const elements = useSelector(selectElements);
  const { showConfirmation } = useModals();

  return useCallback(
    async ({ modId, shouldShowConfirmation = true }) => {
      if (shouldShowConfirmation) {
        const confirmed = await showConfirmation(DEACTIVATE_MOD_MODAL_PROPS);

        if (!confirmed) {
          return;
        }
      }

      const extensionIds = uniq(
        [...extensions, ...elements]
          .filter((x) => getModIdForElement(x) === modId)
          .map((x) => getIdForElement(x)),
      );
      await Promise.all(
        extensionIds.map(async (extensionId) =>
          removeModComponentFromStorage({
            extensionId,
          }),
        ),
      );

      void clearLog({
        blueprintId: modId,
      });

      dispatch(actions.removeRecipeData(modId));
    },
    [
      dispatch,
      elements,
      extensions,
      useRemoveModComponentFromStorage,
      showConfirmation,
    ],
  );
}

export default useDeactivateMod;
