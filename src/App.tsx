import { useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { BottomNav } from "./components/BottomNav";
import { HomeScreen } from "./components/HomeScreen";
import { LegalScreen } from "./components/LegalScreen";
import type { TabId } from "./types";

type AppRoute = TabId | "privacy";

function readInitialRoute(): AppRoute {
  if (window.location.hash === "#area-personal") {
    return "personal";
  }

  if (window.location.hash === "#privacidad") {
    return "privacy";
  }

  return "home";
}

export default function App() {
  const [activeRoute, setActiveRoute] = useState<AppRoute>(readInitialRoute);

  useEffect(() => {
    function syncFromHash() {
      setActiveRoute(readInitialRoute());
    }

    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function handleTabChange(tab: TabId) {
    setActiveRoute(tab);
    window.history.replaceState(
      null,
      "",
      tab === "personal" ? "#area-personal" : window.location.pathname,
    );
  }

  return (
    <main className="app-shell">
      <div className="phone-viewport">
        {activeRoute === "home" && <HomeScreen />}
        {activeRoute === "personal" && <AuthScreen />}
        {activeRoute === "privacy" && <LegalScreen />}
        <BottomNav
          activeTab={activeRoute === "home" ? "home" : "personal"}
          onChange={handleTabChange}
        />
      </div>
    </main>
  );
}
