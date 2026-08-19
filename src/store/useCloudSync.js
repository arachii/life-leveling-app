import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { get, onValue, push, set } from "firebase/database";
import { authClient, backupRootRef, sharedStateRef } from "../config/firebase.js";
import { sanitizeState } from "../domain/state.js";

function deviceId() {
  const key = "life-village-v15-device";
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

export function useCloudSync(state, dispatch, latest) {
  const [status, setStatus] = useState("連線中");
  const [authStatus, setAuthStatus] = useState("匿名登入中");
  const [authReady, setAuthReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudExists, setCloudExists] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const [error, setError] = useState("");
  const applyingRemote = useRef(false);
  const timer = useRef(null);
  const origin = useRef(deviceId());

  useEffect(() => {
    const stop = onAuthStateChanged(authClient, async (user) => {
      if (user) {
        setAuthReady(true);
        setAuthStatus("匿名連線完成");
        return;
      }
      try {
        await signInAnonymously(authClient);
      } catch (err) {
        setAuthReady(false);
        setAuthStatus("匿名連線失敗");
        setStatus("離線模式");
        setError(err?.message || "Firebase 無法登入");
      }
    });
    return stop;
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;

    setStatus("連線中");
    const stop = onValue(
      sharedStateRef,
      (snapshot) => {
        const envelope = snapshot.val();

        if (!envelope?.payload) {
          setCloudReady(true);
          setCloudExists(false);
          setStatus("雲端尚未建立");
          setError("");
          return;
        }

        setCloudReady(true);
        setCloudExists(true);
        setLastSyncAt(Number(envelope.changedAt || 0));
        setError("");

        const remote = sanitizeState(envelope.payload);
        const local = latest.current;
        if (Number(envelope.changedAt || 0) > Number(local.meta.updatedAt || 0)) {
          applyingRemote.current = true;
          dispatch({ type: "replace", state: remote });
        }
        setStatus("已同步");
      },
      (err) => {
        setStatus("同步失敗");
        setError(err?.message || "Firebase 讀取失敗");
      }
    );

    return stop;
  }, [authReady, dispatch, latest]);

  useEffect(() => {
    if (!authReady || !cloudReady) return;

    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }

    if (timer.current) window.clearTimeout(timer.current);
    setStatus("同步中");

    timer.current = window.setTimeout(async () => {
      try {
        const current = latest.current;
        await set(sharedStateRef, {
          payload: current,
          changedAt: current.meta.updatedAt,
          origin: origin.current,
          schema: 15,
        });
        setCloudExists(true);
        setLastSyncAt(current.meta.updatedAt);
        setStatus("已同步");
        setError("");
      } catch (err) {
        setStatus("同步失敗");
        setError(err?.message || "Firebase 寫入失敗");
      }
    }, 800);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state, authReady, cloudReady, latest]);

  async function pushThisDevice() {
    if (!authReady) throw new Error("匿名連線尚未完成");
    setStatus("上傳中");

    const old = await get(sharedStateRef);
    if (old.exists()) await push(backupRootRef, old.val());

    const current = latest.current;
    const changedAt = Date.now();
    await set(sharedStateRef, {
      payload: current,
      changedAt,
      origin: origin.current,
      schema: 15,
    });

    setCloudReady(true);
    setCloudExists(true);
    setLastSyncAt(changedAt);
    setStatus("已同步");
    setError("");
  }

  async function pullCloud() {
    if (!authReady) throw new Error("匿名連線尚未完成");
    setStatus("下載中");

    const snap = await get(sharedStateRef);
    const envelope = snap.val();
    if (!envelope?.payload) {
      setCloudReady(true);
      setCloudExists(false);
      setStatus("雲端尚未建立");
      return false;
    }

    applyingRemote.current = true;
    dispatch({ type: "replace", state: sanitizeState(envelope.payload) });
    setCloudReady(true);
    setCloudExists(true);
    setLastSyncAt(Number(envelope.changedAt || Date.now()));
    setStatus("已同步");
    setError("");
    return true;
  }

  return {
    status,
    authStatus,
    cloudExists,
    lastSyncAt,
    error,
    pushThisDevice,
    pullCloud,
  };
}
