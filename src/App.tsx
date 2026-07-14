import { useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { BottomNav } from "./components/BottomNav";
import { EventsScreen } from "./components/EventsScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LegalScreen } from "./components/LegalScreen";
import { ShopScreen } from "./components/ShopScreen";
import {
  EVENTS_ROUTE_HASH,
  HOME_ROUTE_HASH,
  PERSONAL_ROUTE_HASH,
  PRIVACY_ROUTE_HASH,
  SHOP_ROUTE_HASH,
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

function isSignupConfirmationRoute() {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("confirmed") === "1";
}

function readInitialRoute(): AppRoute {
  if (window.location.hash === HOME_ROUTE_HASH) {
    return "home";
  }

  if (window.location.hash === EVENTS_ROUTE_HASH) {
    return "events";
  }

  if (window.location.hash === SHOP_ROUTE_HASH) {
    return "shop";
  }

  if (
    window.location.hash === PERSONAL_ROUTE_HASH ||
    window.location.hash === SIGNUP_ROUTE_HASH ||
    isPasswordRecoveryRoute() ||
    isSignupConfirmationRoute()
  ) {
    return "membership";
  }

  if (window.location.hash.startsWith(PRIVACY_ROUTE_HASH)) {
    return "privacy";
  }

  return "membership";
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
    const nextHash =
      tab === "home"
        ? HOME_ROUTE_HASH
        : tab === "membership"
          ? SIGNUP_ROUTE_HASH
          : tab === "events"
            ? EVENTS_ROUTE_HASH
            : SHOP_ROUTE_HASH;

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${nextHash}`,
    );
  }

  return (
    <main className="app-shell">
      <div className="phone-viewport">
        {activeRoute === "home" && <HomeScreen />}
        {activeRoute === "membership" && <AuthScreen />}
        {activeRoute === "events" && <EventsScreen />}
        {activeRoute === "shop" && <ShopScreen />}
        {activeRoute === "privacy" && <LegalScreen />}
        <BottomNav
          activeTab={
            activeRoute === "events" || activeRoute === "shop"
              ? activeRoute
              : activeRoute === "home"
                ? "home"
                : "membership"
          }
          onChange={handleTabChange}
        />
      </div>
    </main>
  );
}
