import { useState } from "react";
import { prettySyncTime } from "../domain/time.js";
import { recoverOriginalCloudRecord } from "../migration/recoverOriginalCloud.js";
import { Panel, SectionTitle } from "../ui/ShellParts.jsx";

export default function SettingsPage({ state, dispatch, cloud }) {
  const [health, setHealth] = useState({
    calorieTarget: state.health.calorieTarget,
    warningLimit: state.health.warningLimit,
    goalWeight: state.health.goalWeight,
    heightCm: state.health.heightCm,
  });
  const [recovering, setRecovering] = useState(false);

  async function upload() {
    if (!window.confirm("確定把這台資料設為共用主檔？現有 v15 雲端資料會先備份。")) return;
    try { await cloud.pushThisDevice(); } catch (err) { alert(err.message); }
  }

  async function download() {
    if (!window.confirm("確定用 v15 雲端主檔覆蓋這台目前資料？")) return;
    try { await cloud.pullCloud(); } catch (err) { alert(err.message); }
  }

  async function recoverOriginal() {
    if (!window.confirm(
      "這會從 Firebase 的原始共用主檔／備份找回舊紀錄，轉成 v15 格式並覆蓋目前這台 v15 資料。確定繼續？"
    )) return;

    setRecovering(true);
    try {
      const result = await recoverOriginalCloudRecord();
      dispatch({ type: "replace", state: result.state });

      const s = result.summary;
      alert(
        `找回成功：${result.source}\n\n` +
        `金幣：${s.coins}\n` +
        `EXP：${s.xp}\n` +
        `智慧：${s.wisdom}\n` +
        `歷史戰報：${s.reports} 筆\n` +
        `復盤：${s.reflections} 筆\n` +
        `原則：${s.principles} 條\n` +
        `Boss：${s.bosses} 個\n` +
        `體重紀錄：${s.weights} 筆\n\n` +
        `資料已轉成 v15。接著等待右上同步狀態變成「已同步」。`
      );
    } catch (err) {
      alert(`找回失敗：${err?.message || err}`);
    } finally {
      setRecovering(false);
    }
  }

  return (
    <section className="page-stack">
      <SectionTitle title="設定" />

      <Panel className="warning">
        <h3>找回原始紀錄</h3>
        <p>
          v15 使用新的資料結構與新的雲端位置，因此不會直接看到原本的紀錄。
          這個功能會讀取 Firebase 尚保留的原始共用主檔；若主檔不存在，會再找最新備份，
          然後轉換成 v15。
        </p>
        <button className="primary wide" disabled={recovering} onClick={recoverOriginal}>
          {recovering ? "正在找回…" : "從 Firebase 找回原始紀錄"}
        </button>
      </Panel>

      <Panel>
        <h3>v15 三端共用存檔</h3>
        <p>匿名登入 Firebase，不需要帳號密碼。平常修改會自動同步；也可手動指定主檔。</p>
        <div className="record-line"><span>同步狀態</span><b>{cloud.status}</b></div>
        <div className="record-line"><span>Firebase</span><b>{cloud.authStatus}</b></div>
        <div className="record-line"><span>雲端</span><b>{cloud.cloudExists ? "已建立" : "尚未建立"}</b></div>
        <div className="record-line"><span>上次同步</span><b>{prettySyncTime(cloud.lastSyncAt)}</b></div>
        {cloud.error && <div className="error-box">{cloud.error}</div>}
        <div className="button-grid two">
          <button className="primary" onClick={upload}>這台設為 v15 主檔</button>
          <button className="secondary" onClick={download} disabled={!cloud.cloudExists}>下載 v15 雲端主檔</button>
        </div>
      </Panel>

      <Panel>
        <h3>健康設定</h3>
        <div className="form-grid two">
          <label>每日目標<input type="number" value={health.calorieTarget} onChange={(e) => setHealth({ ...health, calorieTarget: e.target.value })} /></label>
          <label>警戒線<input type="number" value={health.warningLimit} onChange={(e) => setHealth({ ...health, warningLimit: e.target.value })} /></label>
          <label>目標體重<input type="number" step="0.1" value={health.goalWeight} onChange={(e) => setHealth({ ...health, goalWeight: e.target.value })} /></label>
          <label>身高 cm<input type="number" value={health.heightCm} onChange={(e) => setHealth({ ...health, heightCm: e.target.value })} /></label>
        </div>
        <button className="primary wide" onClick={() => dispatch({ type: "health/settings", ...health })}>保存健康設定</button>
      </Panel>

      <Panel>
        <h3>系統維護</h3>
        <p>固定人生主線若因修改或同步缺少，可一鍵重建。</p>
        <button className="secondary wide" onClick={() => dispatch({ type: "task/repair" })}>修復固定人生主線</button>
      </Panel>

      <button className="danger-btn wide" onClick={() => {
        if (window.confirm("確定全部重來？v15 本機資料會清空，之後同步也會更新 v15 雲端。")) {
          dispatch({ type: "all/reset" });
        }
      }}>全部重來</button>
    </section>
  );
}
