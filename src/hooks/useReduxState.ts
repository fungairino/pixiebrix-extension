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
import { useDispatch, useSelector } from "react-redux";
import { type Action, type AnyAction, type Dispatch } from "@reduxjs/toolkit";

/**
 * Hook to simplify getting and setting value in the Redux store.
 * This is a shortcut that you can use instead of 2 separate hooks: useSelector and useDispatch.
 * If you need read only or write only access to state, use the respective hook instead.
 */
const useReduxState = <TValue, TState, TAction extends Action = AnyAction>(
  selector: (state: TState) => TValue,
  actionCreator: (nextValue: TValue) => TAction,
): [TValue, (nextValue: TValue) => void] => {
  const value = useSelector(selector);

  const dispatch = useDispatch<Dispatch<TAction>>();
  const setValue = useCallback(
    (nextValue: TValue) => {
      dispatch(actionCreator(nextValue));
    },
    [dispatch, actionCreator],
  );

  return [value, setValue];
};

export default useReduxState;
