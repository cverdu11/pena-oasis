import { useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { BottomNav } from "./components/BottomNav";
import { HomeScreen } from "./components/HomeScreen";
import type { TabId } from "./types";

function readInitialTab(): TabId {
  return window.location.hash === "#area-personal" ? "personal" : "home";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(readInitialTab);

  useEffect(() => {
    function syncFromHash() {
      setActiveTab(readInitialTab());
    }

    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    window.history.replaceState(
      null,
      "",
      tab === "personal" ? "#area-personal" : window.location.pathname,
    );
  }

  return (
    <main className="app-shell">
      <div className="phone-viewport">
        {activeTab === "home" ? <HomeScreen /> : <AuthScreen />}
        <BottomNav activeTab={activeTab} onChange={handleTabChange} />
      </div>
    </main>
  );
}
