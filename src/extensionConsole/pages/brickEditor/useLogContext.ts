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

import { useDebounce } from "use-debounce";
import { loadBrickYaml } from "@/runtime/brickYaml";
import { useDispatch } from "react-redux";
import { logActions } from "@/components/logViewer/logSlice";
import { useEffect } from "react";
import { type MessageContext } from "@/types/loggerTypes";
import { type Definition } from "@/types/registryTypes";

const LOG_MESSAGE_CONTEXT_DEBOUNCE_MS = 350;

/**
 * Hook that returns the log message MessageContext corresponding to a YAML brick config.
 */
function useLogContext(config: string | null) {
  // Track latest context, as there will be intermediate states where the YAML is invalid
  const [debouncedConfig] = useDebounce(
    config,
    LOG_MESSAGE_CONTEXT_DEBOUNCE_MS,
  );

  const dispatch = useDispatch();

  useEffect(() => {
    let json: Definition;
    try {
      json = loadBrickYaml(debouncedConfig) as Definition;
    } catch {
      // The config won't always be valid YAML when editing
      return;
    }

    const id = json.metadata?.id;

    let messageContext: MessageContext | null;
    switch (json.kind) {
      case "service": {
        messageContext = { serviceId: id };
        break;
      }

      case "extensionPoint": {
        messageContext = { extensionPointId: id };
        break;
      }

      case "component":
      case "reader": {
        messageContext = { blockId: id };
        break;
      }

      case "recipe": {
        messageContext = { blueprintId: id };
        break;
      }

      default: {
        messageContext = null;
      }
    }

    dispatch(logActions.setContext(messageContext));
  }, [debouncedConfig, dispatch]);
}

export default useLogContext;
