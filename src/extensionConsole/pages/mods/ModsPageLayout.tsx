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

import styles from "./ModsPageLayout.module.scss";

import { Card, Col, Row as BootstrapRow } from "react-bootstrap";
import React, { useMemo } from "react";
import {
  type Column,
  type Row,
  useFilters,
  useGlobalFilter,
  useGroupBy,
  useSortBy,
  useTable,
} from "react-table";
import ModsPageSidebar from "./ModsPageSidebar";
import {
  selectActiveTab,
  selectGroupBy,
  selectSearchQuery,
  selectSortBy,
} from "./modsPageSelectors";
import { useSelector } from "react-redux";
import { uniq } from "lodash";
import useModViewItems from "@/mods/useModViewItems";
import AutoSizer, { type Size } from "react-virtualized-auto-sizer";
import ModsPageToolbar from "@/extensionConsole/pages/mods/ModsPageToolbar";
import ModsPageContent from "@/extensionConsole/pages/mods/ModsPageContent";
import Loader from "@/components/Loader";
import type { Mod, ModViewItem } from "@/types/modTypes";

const statusFilter = (
  rows: Array<Row<ModViewItem>>,
  _: string[],
  filterValue: string,
) => {
  // For UX purposes, Paused deployments will be included under the "Active" filter
  const filterValues = [
    filterValue,
    ...(filterValue === "Active" ? ["Paused"] : []),
  ];

  return rows.filter((row) => filterValues.includes(row.original.status));
};

// These react-table columns aren't rendered as column headings,
// but used to expose grouping, sorting, filtering, and global
// searching utilities on ModViewItems
const columns: Array<Column<ModViewItem>> = [
  {
    Header: "Name",
    accessor: "name",
    disableGroupBy: true,
    disableFilters: true,
  },
  {
    Header: "Description",
    accessor: "description",
    disableGroupBy: true,
    disableFilters: true,
    disableSortBy: true,
  },
  {
    Header: "Package ID",
    // @ts-expect-error -- react-table allows nested accessors
    accessor: "sharing.packageId",
    disableGroupBy: true,
    disableFilters: true,
    disableSortBy: true,
  },
  {
    Header: "Source",
    // @ts-expect-error -- react-table allows nested accessors
    accessor: "sharing.source.label",
    disableGlobalFilter: true,
  },
  {
    Header: "Last updated",
    accessor: "updatedAt",
    disableGroupBy: true,
    disableFilters: true,
    disableGlobalFilter: true,
    sortInverted: true,
  },
  {
    Header: "Status",
    accessor: "status",
    disableGlobalFilter: true,
    filter: statusFilter,
  },
];

const ModsPageLayout: React.FunctionComponent<{
  mods: Mod[];
}> = ({ mods }) => {
  const { modViewItems, isLoading } = useModViewItems(mods);

  const teamFilters = useMemo(
    () =>
      uniq(modViewItems.map((mod) => mod.sharing.source.label)).filter(
        (label) => label !== "Public" && label !== "Personal",
      ),
    [modViewItems],
  );

  const groupBy = useSelector(selectGroupBy);
  const sortBy = useSelector(selectSortBy);
  const activeTab = useSelector(selectActiveTab);
  const searchQuery = useSelector(selectSearchQuery);

  const tableInstance = useTable<ModViewItem>(
    {
      columns,
      data: modViewItems,
      initialState: {
        groupBy,
        sortBy,
        filters: activeTab.filters,
        globalFilter: searchQuery,
      },
      useControlledState: (state) =>
        useMemo(
          () => ({
            ...state,
            groupBy,
            sortBy,
            filters: activeTab.filters,
            globalFilter: searchQuery,
          }),
          // eslint-disable-next-line react-hooks/exhaustive-deps -- table props are required dependencies
          [searchQuery, state, groupBy, sortBy, activeTab.filters],
        ),
    },
    useFilters,
    useGlobalFilter,
    useGroupBy,
    useSortBy,
  );

  return (
    <BootstrapRow className={styles.root}>
      <ModsPageSidebar
        teamFilters={teamFilters}
        tableInstance={tableInstance}
      />
      <Col className={styles.mainContainer} sm={12} md={9} xl={10}>
        <ModsPageToolbar tableInstance={tableInstance} />
        {/* This wrapper prevents AutoSizer overflow in a flex box container */}
        <div style={{ flex: "1 1 auto" }}>
          {isLoading ? (
            <Card>
              <Card.Body>
                <Loader />
              </Card.Body>
            </Card>
          ) : (
            <AutoSizer defaultHeight={500}>
              {({ height, width }: Size) => (
                <ModsPageContent
                  tableInstance={tableInstance}
                  width={width}
                  height={height}
                />
              )}
            </AutoSizer>
          )}
        </div>
      </Col>
    </BootstrapRow>
  );
};

export default ModsPageLayout;
