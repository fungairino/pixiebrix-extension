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

import { actions as savingExtensionActions } from "./savingExtensionSlice";
import { useDispatch, useSelector } from "react-redux";
import { selectIsSaving, selectIsWizardOpen } from "./savingExtensionSelectors";
import {
  selectActiveElement,
  selectElements,
} from "@/pageEditor/slices/editorSelectors";
import useUpsertModComponentFormState from "@/pageEditor/hooks/useUpsertModComponentFormState";
import { actions as editorActions } from "@/pageEditor/slices/editorSlice";
import { uuidv4, validateRegistryId } from "@/types/helpers";
import useResetExtension from "@/pageEditor/hooks/useResetExtension";
import {
  type Metadata,
  type RegistryId,
  type SemVerString,
} from "@/types/registryTypes";
import notify from "@/utils/notify";
import { selectExtensions } from "@/store/extensionsSelectors";
import {
  useCreateRecipeMutation,
  useGetEditablePackagesQuery,
  useUpdateRecipeMutation,
} from "@/services/api";
import { replaceModComponent } from "./saveHelpers";
import extensionsSlice from "@/store/extensionsSlice";
import pDefer, { type DeferredPromise } from "p-defer";
import { type PackageUpsertResponse } from "@/types/contract";
import { pick } from "lodash";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { useAllModDefinitions } from "@/modDefinitions/modDefinitionHooks";
import {
  type ModComponentBase,
  type ActivatedModComponent,
} from "@/types/modComponentTypes";
import { type UnsavedModDefinition } from "@/types/modDefinitionTypes";

const { actions: optionsActions } = extensionsSlice;

type RecipeConfiguration = {
  id: RegistryId;
  name: string;
  version?: SemVerString;
  description?: string;
};

let savingDeferred: DeferredPromise<void>;

export function selectRecipeMetadata(
  unsavedRecipe: UnsavedModDefinition,
  response: PackageUpsertResponse,
): ModComponentBase["_recipe"] {
  return {
    ...unsavedRecipe.metadata,
    sharing: pick(response, ["public", "organizations"]),
    ...pick(response, ["updated_at"]),
  };
}

const useSavingWizard = () => {
  const dispatch = useDispatch();
  const upsertModComponentFormState = useUpsertModComponentFormState();
  const reset = useResetExtension();
  const isWizardOpen = useSelector(selectIsWizardOpen);
  const isSaving = useSelector(selectIsSaving);
  const extensions = useSelector(selectExtensions);
  const elements = useSelector(selectElements);
  const element = useSelector(selectActiveElement);

  const { data: recipes } = useAllModDefinitions();
  const { data: editablePackages } = useGetEditablePackagesQuery();
  const [createRecipe] = useCreateRecipeMutation();
  const [updateRecipe] = useUpdateRecipeMutation();

  const save = async () => {
    if (element.recipe == null) {
      void saveNonRecipeElement();
    } else {
      // The user might lose access to the recipe while they were editing it (the recipe or an extension)
      // See https://github.com/pixiebrix/pixiebrix-extension/issues/2813
      const recipe = recipes.find((x) => x.metadata.id === element.recipe.id);
      if (!recipe) {
        notify.error(
          "You no longer have edit permissions for the mod. Please reload the Page Editor.",
        );
        return;
      }
    }

    savingDeferred = pDefer<void>();

    dispatch(savingExtensionActions.openWizard());
    return savingDeferred.promise;
  };

  /**
   * Saves an extension that is not a part of a Recipe
   */
  async function saveNonRecipeElement() {
    dispatch(savingExtensionActions.setSavingInProgress());
    const error = await upsertModComponentFormState({
      element,
      options: {
        pushToCloud: true,
        checkPermissions: true,
        notifySuccess: true,
        reactivateEveryTab: true,
      },
    });
    closeWizard(error);
  }

  /**
   * Creates personal extension from a page editor element. It will not be a part of the Recipe
   */
  const saveElementAsPersonalExtension = async () => {
    dispatch(savingExtensionActions.setSavingInProgress());

    // Stripping the recipe-related data from the element
    const { recipe, optionsDefinition, ...rest } = element;
    const personalElement: ModComponentFormState = {
      ...rest,
      uuid: uuidv4(),
      // Detach from the recipe
      recipe: undefined,
    };

    dispatch(editorActions.addElement(personalElement));
    await reset({ extensionId: element.uuid, shouldShowConfirmation: false });

    const error = await upsertModComponentFormState({
      element: personalElement,
      options: {
        pushToCloud: true,
        // Should already have permissions because it already exists
        checkPermissions: false,
        notifySuccess: true,
        reactivateEveryTab: true,
      },
    });

    if (!error) {
      dispatch(editorActions.removeElement(element.uuid));
      dispatch(optionsActions.removeExtension({ extensionId: element.uuid }));
    }

    closeWizard(error);
  };

  /**
   * 1. Creates new recipe,
   * 2. Updates all extensions of the old recipe to point to the new one, and
   * 3. Saves the changes of the element.
   */
  const saveElementAndCreateNewRecipe = async (
    recipeMeta: RecipeConfiguration,
  ) => {
    dispatch(savingExtensionActions.setSavingInProgress());

    const elementRecipeMeta = element.recipe;
    const recipe = recipes.find((x) => x.metadata.id === elementRecipeMeta.id);

    if (recipeMeta.id === recipe.metadata.id) {
      closeWizard("You must provide a new id for the mod");
      return;
    }

    const newMeta: Metadata = {
      ...recipeMeta,
      id: validateRegistryId(recipeMeta.id),
    };

    const newRecipe: UnsavedModDefinition = replaceModComponent(
      recipe,
      newMeta,
      extensions,
      element,
    );

    const createRecipeResponse = await createRecipe({
      recipe: newRecipe,
      // Don't share with anyone (only the author will have access)
      organizations: [],
      public: false,
    });

    if ("error" in createRecipeResponse) {
      const errorMessage = "Failed to create new mod";
      notify.error({
        message: errorMessage,
        error: createRecipeResponse.error,
      });
      closeWizard(errorMessage);
      return;
    }

    const createExtensionError = await upsertModComponentFormState({
      element,
      options: {
        // `pushToCloud` to false because we don't want to save a copy of the individual extension to the user's account
        // because it will already be available via the blueprint
        pushToCloud: false,
        checkPermissions: true,
        notifySuccess: true,
        reactivateEveryTab: true,
      },
      modId: newRecipe.metadata.id,
    });

    if (createExtensionError) {
      closeWizard(createExtensionError);
      return;
    }

    updateExtensionRecipeLinks(
      recipe.metadata.id,
      selectRecipeMetadata(newRecipe, createRecipeResponse.data),
      // Unlink the installed extensions from the deployment
      { _deployment: null as ModComponentBase["_deployment"] },
    );

    closeWizard(createExtensionError);
  };

  /**
   * 1. Updates new recipe,
   * 2. Updates all extensions of the recipe with the new metadata, and
   * 3. Saves the changes of the element
   */
  const saveElementAndUpdateRecipe = async (
    recipeMeta: RecipeConfiguration,
  ) => {
    dispatch(savingExtensionActions.setSavingInProgress());

    const elementRecipeMeta = element.recipe;
    const recipe = recipes.find((x) => x.metadata.id === elementRecipeMeta.id);

    const newRecipe: UnsavedModDefinition = replaceModComponent(
      recipe,
      recipeMeta,
      extensions,
      element,
    );

    const packageId = editablePackages.find(
      // Bricks endpoint uses "name" instead of id
      (x) => x.name === newRecipe.metadata.id,
    )?.id;

    const updateRecipeResponse = await updateRecipe({
      packageId,
      recipe: newRecipe,
    });

    if ("error" in updateRecipeResponse) {
      const errorMessage = "Failed to update the mod";
      notify.error({
        message: errorMessage,
        error: updateRecipeResponse.error,
      });
      closeWizard(errorMessage);
      return;
    }

    const error = await upsertModComponentFormState({
      element,
      options: {
        pushToCloud: true,
        checkPermissions: true,
        notifySuccess: true,
        reactivateEveryTab: true,
      },
      modId: newRecipe.metadata.id,
    });

    if (error) {
      closeWizard(error);
      return;
    }

    updateExtensionRecipeLinks(
      recipe.metadata.id,
      selectRecipeMetadata(newRecipe, updateRecipeResponse.data),
    );

    closeWizard(error);
  };

  function updateExtensionRecipeLinks(
    recipeId: RegistryId,
    recipeMetadata: ModComponentBase["_recipe"],
    extraUpdate: Partial<ActivatedModComponent> = {},
  ) {
    // 1) Update the extensions in the Redux optionsSlice
    const recipeExtensions = extensions.filter(
      (x) => x._recipe?.id === recipeId,
    );

    for (const recipeExtension of recipeExtensions) {
      const update = {
        id: recipeExtension.id,
        _recipe: recipeMetadata,
        ...extraUpdate,
      };

      dispatch(optionsActions.updateExtension(update));
    }

    // 2) Update the extensions in the Redux editorSlice (the slice for the page editor)
    const recipeElements = elements.filter((x) => x.recipe?.id === recipeId);

    for (const recipeElement of recipeElements) {
      const elementUpdate = {
        uuid: recipeElement.uuid,
        recipe: recipeMetadata,
      };

      dispatch(editorActions.updateElement(elementUpdate));
    }
  }

  function closeWizard(errorMessage?: string | null) {
    dispatch(savingExtensionActions.closeWizard());

    if (savingDeferred) {
      if (errorMessage) {
        savingDeferred.reject(errorMessage);
      } else {
        savingDeferred.resolve();
      }

      savingDeferred = null;
    }
  }

  return {
    isWizardOpen,
    isSaving,
    element,
    save,
    saveElementAsPersonalExtension,
    saveElementAndCreateNewRecipe,
    saveElementAndUpdateRecipe,
    closeWizard,
  };
};

export default useSavingWizard;
