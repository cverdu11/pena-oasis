import { useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { BottomNav } from "./components/BottomNav";
import { HomeScreen } from "./components/HomeScreen";
import { LegalScreen } from "./components/LegalScreen";
import {
  PERSONAL_ROUTE_HASH,
  PRIVACY_ROUTE_HASH,
  SIGNUP_ROUTE_HASH,
} from "./constants";
import type { TabId } from "./types";

type AppRoute = TabId | "privacy";

function isPasswordRecoveryRoute() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    searchParams.get("recovery") === "1" ||
    hashParams.get("type") === "recovery"
  );
}

function readInitialRoute(): AppRoute {
  if (
    window.location.hash === PERSONAL_ROUTE_HASH ||
    window.location.hash === SIGNUP_ROUTE_HASH ||
    isPasswordRecoveryRoute()
  ) {
    return "personal";
  }

  if (window.location.hash.startsWith(PRIVACY_ROUTE_HASH)) {
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
      tab === "personal"
        ? `${window.location.pathname}${PERSONAL_ROUTE_HASH}`
        : window.location.pathname,
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
