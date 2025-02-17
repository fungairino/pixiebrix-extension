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

import { datadogRum } from "@datadog/browser-rum";
import { getDNT } from "@/telemetry/dnt";
import { getBaseURL } from "@/services/baseService";
import { expectContext, forbidContext } from "@/utils/expectContext";
import { addListener as addAuthListener, readAuthData } from "@/auth/token";
import { flagOn } from "@/auth/authUtils";
import {
  cleanDatadogVersionName,
  mapAppUserToTelemetryUser,
} from "@/telemetry/telemetryHelpers";
import type { UserData } from "@/auth/authTypes";

const environment = process.env.ENVIRONMENT;
const applicationId = process.env.DATADOG_APPLICATION_ID;
const clientToken = process.env.DATADOG_CLIENT_TOKEN;

const RUM_FLAG = "telemetry-performance";

/**
 * Initialize Datadog Real User Monitoring (RUM) for performance monitoring.
 */
export async function initPerformanceMonitoring(): Promise<void> {
  // Require the extension context because we don't want to track performance of the host sites
  expectContext("extension");

  forbidContext("contentScript");
  forbidContext("web");
  // There's no user interactions to track in the background page
  forbidContext("background");

  const baseUrl = await getBaseURL();

  if (await getDNT()) {
    return;
  }

  if (!(await flagOn(RUM_FLAG))) {
    return;
  }

  if (!applicationId || !clientToken) {
    console.warn("Datadog application ID or client token not configured");
    return;
  }

  const { version_name } = browser.runtime.getManifest();

  // https://docs.datadoghq.com/real_user_monitoring/browser/
  datadogRum.init({
    applicationId,
    clientToken,
    site: "datadoghq.com",
    service: "pixiebrix-browser-extension",
    env: environment,
    version: cleanDatadogVersionName(version_name),
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "mask",
    // From the docs, it would appear that useCrossSiteSessionCookie would enable support for iframes like the
    // sidebar and page editor. But in reality, it breaks the Extension Console tracking too.
    // To support in Page Editor and Sidebar because they're iframes
    // useCrossSiteSessionCookie: true,
    // List the URLs/origins for sending trace headers
    // https://docs.datadoghq.com/real_user_monitoring/connect_rum_and_traces/?tab=browserrum#usage
    allowedTracingUrls: [baseUrl],

    // https://github.com/DataDog/browser-sdk/issues/798
    // https://docs.datadoghq.com/real_user_monitoring/guide/monitor-electron-applications-using-browser-sdk/
    allowFallbackToLocalStorage: true,
  });

  datadogRum.setGlobalContextProperty(
    "code_version",
    process.env.SOURCE_VERSION,
  );

  // https://docs.datadoghq.com/real_user_monitoring/browser/modifying_data_and_context/?tab=npm#user-session
  datadogRum.setUser(await mapAppUserToTelemetryUser(await readAuthData()));

  datadogRum.startSessionReplayRecording();

  addAuthListener(updatePerson);
}

async function updatePerson(data: Partial<UserData>): Promise<void> {
  const person = await mapAppUserToTelemetryUser(data);

  console.debug("Setting error telemetry user", person);

  // https://docs.datadoghq.com/real_user_monitoring/browser/modifying_data_and_context/?tab=npm#user-session
  datadogRum.setUser(person);
}
