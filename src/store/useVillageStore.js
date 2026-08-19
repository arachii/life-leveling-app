import { useEffect, useReducer, useRef } from "react";
import { advanceToToday } from "../domain/state.js";
import { loadState, persistState } from "./storage.js";
import { villageReducer } from "./reducer.js";

export function useVillageStore() {
  const [state, dispatch] = useReducer(villageReducer, undefined, loadState);
  const latest = useRef(state);

  useEffect(() => {
    latest.current = state;
    persistState(state);
  }, [state]);

  useEffect(() => {
    const refreshDay = () => {
      const advanced = advanceToToday(latest.current);
      if (advanced !== latest.current) dispatch({ type: "replace", state: advanced });
    };
    const timer = window.setInterval(refreshDay, 60000);
    const onVisibility = () => document.visibilityState === "visible" && refreshDay();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { state, dispatch, latest };
}