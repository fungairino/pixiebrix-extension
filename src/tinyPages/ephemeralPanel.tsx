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

import "bootstrap/dist/css/bootstrap.min.css";
import "./ephemeralModal.scss";

import "@/extensionContext";

import React from "react";
import { render } from "react-dom";
import EphemeralPanel from "@/bricks/transformers/temporaryInfo/EphemeralPanel";
import registerContribBlocks from "@/contrib/registerContribBlocks";
import registerBuiltinBricks from "@/bricks/registerBuiltinBricks";
import { initMessengerLogging } from "@/development/messengerLogging";
import registerMessenger from "@/bricks/transformers/temporaryInfo/messenger/registration";
import "iframe-resizer/js/iframeResizer.contentWindow";
import { initRuntimeLogging } from "@/development/runtimeLogging";

function init(): void {
  console.debug("Initializing ephemeral panel", { location: window.location });
  render(<EphemeralPanel />, document.querySelector("#container"));
}

void initMessengerLogging();
void initRuntimeLogging();
registerMessenger();
registerContribBlocks();
registerBuiltinBricks();
init();
