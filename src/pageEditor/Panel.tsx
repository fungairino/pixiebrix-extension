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

import React from "react";
import store from "./store";
import { Provider } from "react-redux";
import registerBuiltinBricks from "@/bricks/registerBuiltinBricks";
import registerContribBlocks from "@/contrib/registerContribBlocks";
import registerEditors from "@/contrib/editors";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import useRefreshRegistries from "@/hooks/useRefreshRegistries";
import PanelContent from "@/pageEditor/PanelContent";

// Register the built-in bricks
registerEditors();
registerContribBlocks();
registerBuiltinBricks();

// Register Widgets
registerDefaultWidgets();

const Panel: React.VoidFunctionComponent = () => {
  // Refresh the brick registry on mount
  useRefreshRegistries({ refreshOnMount: true });

  return (
    <Provider store={store}>
      <PanelContent />
    </Provider>
  );
};

export default Panel;
