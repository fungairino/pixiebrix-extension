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

import React, { useEffect, useReducer } from "react";
import { type BrickConfig } from "@/bricks/types";
import blockRegistry from "@/bricks/registry";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "react-bootstrap";
import Loader from "@/components/Loader";
import { getErrorMessage } from "@/errors/errorHelpers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faInfoCircle,
  faSync,
} from "@fortawesome/free-solid-svg-icons";
import objectHash from "object-hash";
import { isEmpty } from "lodash";
import { type TraceRecord } from "@/telemetry/trace";
import { removeEmptyValues } from "@/pageEditor/starterBricks/base";
import { runBlock } from "@/contentScript/messenger/api";
import { thisTab } from "@/pageEditor/utils";
import { useField, useFormikContext } from "formik";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import getType from "@/runtime/getType";
import { type BrickType } from "@/runtime/runtimeTypes";
import { DataPanelTabKey } from "@/pageEditor/tabs/editTab/dataPanel/dataPanelTypes";
import DataTabJsonTree from "@/pageEditor/tabs/editTab/dataPanel/DataTabJsonTree";
import { type RegistryId } from "@/types/registryTypes";
import { type Brick } from "@/types/brickTypes";
import { type ApiVersion, type BrickArgsContext } from "@/types/runtimeTypes";
import { type IntegrationDependency } from "@/integrations/integrationTypes";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { type BaseExtensionPointState } from "@/pageEditor/baseFormStateTypes";
import makeServiceContextFromDependencies from "@/integrations/util/makeServiceContextFromDependencies";
import type { FetchableAsyncState } from "@/types/sliceTypes";
import useAsyncState from "@/hooks/useAsyncState";

/**
 * Bricks to preview even if there's no trace.
 */
const HACK_TRACE_OPTIONAL = new Set([
  "@pixiebrix/component-reader",
  "@pixiebrix/jquery-reader",
]);

function isTraceOptional(
  blockId: RegistryId,
  { type }: { type: BrickType },
): boolean {
  return type === "reader" || HACK_TRACE_OPTIONAL.has(blockId);
}

type PreviewInfo = {
  block: Brick;
  type: BrickType;
  isPure: boolean;
  isRootAware: boolean;
  traceOptional: boolean;
};

/**
 * Return metadata about preview requirements for a block.
 */
export function usePreviewInfo(
  blockId: RegistryId,
): FetchableAsyncState<PreviewInfo> {
  return useAsyncState(async () => {
    const block = await blockRegistry.lookup(blockId);
    const type = await getType(block);
    return {
      block,
      isPure: await block.isPure(),
      isRootAware: block.isRootAware ? await block.isRootAware() : false,
      type,
      traceOptional: isTraceOptional(blockId, { type }),
    };
  }, [blockId]);
}

const traceWarning = (
  // The text-warning font color is brutal. This is more of a warning, but this color/style will have to do for now
  <div className="text-info mb-2">
    <FontAwesomeIcon icon={faExclamationTriangle} />
    &nbsp; No trace available. The actual output will differ from the preview if
    the configuration uses templates/variables
  </div>
);

type PreviewState = {
  isRunning: boolean;
  output: unknown;
  outputKey: string;
};

const initialState: PreviewState = {
  isRunning: false,
  output: undefined,
  outputKey: null,
};

const previewSlice = createSlice({
  name: "previewSlice",
  initialState,
  reducers: {
    startRun(state) {
      state.isRunning = true;
    },
    setSuccess(
      state,
      action: PayloadAction<{ output: unknown; outputKey: string }>,
    ) {
      const { output, outputKey } = action.payload;
      state.outputKey = outputKey;
      state.output = outputKey ? { [`@${outputKey}`]: output } : output;
      state.isRunning = false;
    },
    setError(state, action: PayloadAction<{ error: unknown }>) {
      const { error } = action.payload;
      state.output = error;
      state.outputKey = null;
      state.isRunning = false;
    },
  },
});

const BrickPreview: React.FunctionComponent<{
  brickConfig: BrickConfig;
  extensionPoint: BaseExtensionPointState;
  traceRecord: TraceRecord;
  previewRefreshMillis?: 250;
  // eslint-disable-next-line complexity
}> = ({ brickConfig, extensionPoint, traceRecord, previewRefreshMillis }) => {
  const [{ isRunning, output }, dispatch] = useReducer(previewSlice.reducer, {
    ...initialState,
    outputKey: brickConfig.outputKey,
  });

  const { values } = useFormikContext<ModComponentFormState>();
  const [{ value: apiVersion }] = useField<ApiVersion>("apiVersion");
  const [{ value: services }] = useField<IntegrationDependency[]>(
    "integrationDependencies",
  );

  const {
    data: brickInfo,
    isLoading: brickLoading,
    error: brickError,
  } = usePreviewInfo(brickConfig.id);

  // This defaults to "inherit" as described in the doc, see BrickConfig.rootMode
  const brickRootMode = brickConfig.rootMode ?? "inherit";

  const debouncedRun = useDebouncedCallback(
    async (brickConfig: BrickConfig, context: BrickArgsContext) => {
      dispatch(previewSlice.actions.startRun());
      const { outputKey } = brickConfig;

      try {
        const output = await runBlock(thisTab, {
          apiVersion,
          blockConfig: {
            ...removeEmptyValues(brickConfig),
            if: undefined,
          },
          context: {
            ...context,
            ...(await makeServiceContextFromDependencies(services)),
          },
          rootSelector: undefined,
          blueprintId: values.recipe?.id,
        });
        dispatch(previewSlice.actions.setSuccess({ output, outputKey }));
      } catch (error) {
        dispatch(previewSlice.actions.setError({ error }));
      }
    },
    previewRefreshMillis,
    { trailing: true, leading: false },
  );

  const context = traceRecord?.templateContext;

  const showTraceWarning = !traceRecord && brickInfo?.traceOptional;

  useEffect(() => {
    if ((context && brickInfo?.isPure) || brickInfo?.traceOptional) {
      void debouncedRun(brickConfig, context as unknown as BrickArgsContext);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- using objectHash for context
  }, [debouncedRun, brickConfig, brickInfo, objectHash(context ?? {})]);

  if (brickInfo?.type === "renderer") {
    return (
      <div className="text-muted">
        Output previews are not currently supported for renderers
      </div>
    );
  }

  if (brickRootMode === "element") {
    return (
      <div className="text-muted">
        Output Preview is not currently supported when brick is configured with
        &ldquo;Element&rdquo; Target Root Mode
      </div>
    );
  }

  if (brickRootMode === "inherit") {
    return (
      <div className="text-muted">
        Output Preview is not currently supported when brick is configured with
        &ldquo;Inherit&rdquo; Target Root Mode
      </div>
    );
  }

  if (brickLoading || isRunning) {
    return (
      <div>
        {showTraceWarning && traceWarning}
        <Loader />
      </div>
    );
  }

  if (brickError) {
    return (
      <div className="text-danger">
        Error loading brick from registry
        {getErrorMessage(brickError)}
      </div>
    );
  }

  if (!brickInfo?.traceOptional && !traceRecord) {
    return (
      <div className="text-info">
        <FontAwesomeIcon icon={faInfoCircle} /> Run the brick once to enable
        output preview
      </div>
    );
  }

  const isError = output instanceof Error;

  return (
    <div>
      {showTraceWarning && traceWarning}

      {brickInfo != null && !brickInfo.isPure && (
        <Button
          variant="info"
          size="sm"
          disabled={!traceRecord}
          onClick={() => {
            void debouncedRun(brickConfig, context as BrickArgsContext);
          }}
        >
          <FontAwesomeIcon icon={faSync} /> Refresh Preview
        </Button>
      )}

      {output && !isError && !isEmpty(output) && (
        <DataTabJsonTree
          data={output}
          searchable
          copyable
          tabKey={DataPanelTabKey.Preview}
          label="Output Preview"
        />
      )}

      {output && !isError && isEmpty(output) && (
        <div>Brick produced empty output</div>
      )}

      {output && isError && (
        <div className="text-danger">{getErrorMessage(output)}</div>
      )}
    </div>
  );
};

export default BrickPreview;
