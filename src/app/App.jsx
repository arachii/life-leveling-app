import { useState } from "react";
import { Header } from "../ui/ShellParts.jsx";
import Nav from "../ui/Nav.jsx";
import TodayPage from "../pages/TodayPage.jsx";
import PrinciplesPage from "../pages/PrinciplesPage.jsx";
import RewardsPage from "../pages/RewardsPage.jsx";
import CaloriesPage from "../pages/CaloriesPage.jsx";
import RecordsPage from "../pages/RecordsPage.jsx";
import CharacterPage from "../pages/CharacterPage.jsx";
import EnergyPage from "../pages/EnergyPage.jsx";
import SettingsPage from "../pages/SettingsPage.jsx";
import { useVillageStore } from "../store/useVillageStore.js";
import { useCloudSync } from "../store/useCloudSync.js";

export default function App() {
  const [tab, setTab] = useState("today");
  const { state, dispatch, latest } = useVillageStore();
  const cloud = useCloudSync(state, dispatch, latest);

  const pages = {
    today: <TodayPage state={state} dispatch={dispatch} />,
    principles: <PrinciplesPage state={state} dispatch={dispatch} />,
    rewards: <RewardsPage state={state} dispatch={dispatch} />,
    calories: <CaloriesPage state={state} dispatch={dispatch} />,
    records: <RecordsPage state={state} />,
    character: <CharacterPage state={state} />,
    energy: <EnergyPage state={state} dispatch={dispatch} />,
    settings: <SettingsPage state={state} dispatch={dispatch} cloud={cloud} />,
  };

  return (
    <div className="screen">
      <div className="phone">
        <Header state={state} syncStatus={cloud.status} />
        <Nav active={tab} onChange={setTab} />
        <main>{pages[tab]}</main>
      </div>
    </div>
  );
}