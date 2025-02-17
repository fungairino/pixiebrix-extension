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

import styles from "./GridView.module.scss";

import React, {
  type HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { type ModViewItem } from "@/types/modTypes";
import { VariableSizeList as List } from "react-window";
import GridCard from "./GridCard";
import { type Row } from "react-table";
import ListGroupHeader from "@/extensionConsole/pages/mods/listView/ListGroupHeader";
import { uuidv4 } from "@/types/helpers";
import { getUniqueId } from "@/utils/modUtils";
import GridCardErrorBoundary from "@/extensionConsole/pages/mods/gridView/GridCardErrorBoundary";
import { type ModsPageContentProps } from "@/extensionConsole/pages/mods/ModsPageContent";

/**
 *  Expands `react-table` rows recursively in chunks of
 *  `columnCount`, preserving grouped row positioning
 *  for easy grid rendering.
 *  @param rows - `react-table` rows that are either flat or grouped
 *  @param columnCount - number >= 1 of chunked rows to render grid columns
 *  @returns {array} - an array of groupBy rows and/or chunked rows
 */
export function expandGridRows(
  rows: Array<Row<ModViewItem>>,
  columnCount: number,
): Array<Row<ModViewItem> | Array<Row<ModViewItem>>> {
  const gridRows = [];
  let nextGridRow = [];
  for (const row of rows) {
    if (row.isGrouped) {
      gridRows.push(row);

      if (nextGridRow.length > 0) {
        gridRows.push(nextGridRow);
        nextGridRow = [];
      }

      gridRows.push(...expandGridRows(row.subRows, columnCount));
      continue;
    }

    if (nextGridRow.length >= columnCount) {
      gridRows.push(nextGridRow);
      nextGridRow = [];
    }

    nextGridRow.push(row);
  }

  if (nextGridRow.length > 0) {
    gridRows.push(nextGridRow);
  }

  return gridRows;
}

// 220px min card width + 15px padding
// see: GridView.module.scss
const MIN_CARD_WIDTH_PX = 235;
const CARD_HEIGHT_PX = 230;
const HEADER_ROW_HEIGHT_PX = 43;

const GridView: React.VoidFunctionComponent<ModsPageContentProps> = ({
  tableInstance,
  width,
  height,
}) => {
  const [listKey, setListKey] = useState(uuidv4());

  const columnCount = useMemo(
    () => Math.floor(width / MIN_CARD_WIDTH_PX),
    [width],
  );

  const expandedGridRows = useMemo(
    () => expandGridRows(tableInstance.rows, columnCount),
    [columnCount, tableInstance.rows],
  );

  const getItemSize = useCallback(
    (index: number): number => {
      const row = expandedGridRows.at(index);
      return "isGrouped" in row ? HEADER_ROW_HEIGHT_PX : CARD_HEIGHT_PX;
    },
    [expandedGridRows],
  );

  // `react-window` caches itemSize which causes inconsistent
  // row heights/row height flickering on scroll when data changes,
  // even with non-index `itemKeys`.
  // Re-render the list when expandedRows changes.
  useEffect(() => {
    setListKey(uuidv4());
  }, [expandedGridRows, columnCount]);

  const GridRow = useCallback(
    ({
      index,
      style,
    }: {
      index: number;
      style: HTMLAttributes<HTMLDivElement>["style"];
    }) => {
      const gridRow = expandedGridRows.at(index);

      if ("isGrouped" in gridRow) {
        tableInstance.prepareRow(gridRow);

        return <ListGroupHeader groupName={gridRow.groupByVal} style={style} />;
      }

      return (
        <div style={style} className={styles.root}>
          {gridRow.map((row: Row<ModViewItem>) => {
            tableInstance.prepareRow(row);
            return (
              <GridCardErrorBoundary
                modViewItem={row.original}
                key={getUniqueId(row.original.mod)}
              >
                <GridCard
                  key={getUniqueId(row.original.mod)}
                  modViewItem={row.original}
                />
              </GridCardErrorBoundary>
            );
          })}
        </div>
      );
    },
    [expandedGridRows, tableInstance],
  );

  return (
    <List
      height={height}
      width={width}
      itemSize={getItemSize}
      itemCount={expandedGridRows.length}
      key={listKey}
    >
      {GridRow}
    </List>
  );
};

export default GridView;
