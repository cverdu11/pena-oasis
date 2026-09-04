import { useEffect, useState } from "react";
import { AccountMenu } from "./components/AccountMenu";
import type { AccountMenuAction } from "./components/AccountMenu";
import { AuthScreen } from "./components/AuthScreen";
import { BottomNav } from "./components/BottomNav";
import { EventsScreen } from "./components/EventsScreen";
import { GuestReservationScreen } from "./components/GuestReservationScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LegalScreen } from "./components/LegalScreen";
import { NewsArticleScreen } from "./components/NewsArticleScreen";
import { ShopScreen } from "./components/ShopScreen";
import { StockAdminScreen } from "./components/StockAdminScreen";
import { useMemberIdentity } from "./hooks/useMemberIdentity";
import { getSupabaseClient } from "./lib/supabase";
import {
  EVENTS_ROUTE_HASH,
  GUEST_RESERVATION_ROUTE_HASH,
  HOME_ROUTE_HASH,
  NEWS_ARTICLE_ROUTE_HASH,
  PERSONAL_ROUTE_HASH,
  PRIVACY_ROUTE_HASH,
  SHOP_ROUTE_HASH,
  SHIRT_STOCK_ADMIN_ROUTE_HASH,
  SIGNUP_ROUTE_HASH,
} from "./constants";
import type { PersonalAreaAction, StockAdminRoute, TabId } from "./types";

type AppRoute =
  | TabId
  | "news-article"
  | "privacy"
  | "reservation"
  | StockAdminRoute;

function isLocalPersonalPreview() {
  const isLocalHost =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";
  const searchParams = new URLSearchParams(window.location.search);

  return isLocalHost && searchParams.get("demo") === "personal";
}

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
  if (isLocalPersonalPreview()) {
    return "membership";
  }

  if (window.location.hash === NEWS_ARTICLE_ROUTE_HASH) {
    return "news-article";
  }

  if (window.location.hash === HOME_ROUTE_HASH) {
    return "home";
  }

  if (window.location.hash === EVENTS_ROUTE_HASH) {
    return "events";
  }

  if (window.location.hash === SHOP_ROUTE_HASH) {
    return "shop";
  }

  if (window.location.hash === SHIRT_STOCK_ADMIN_ROUTE_HASH) {
    return "stock-admin";
  }

  if (window.location.hash.startsWith(GUEST_RESERVATION_ROUTE_HASH)) {
    return "reservation";
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
  const localPersonalPreview = isLocalPersonalPreview();
  const [activeRoute, setActiveRoute] = useState<AppRoute>(readInitialRoute);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [personalAreaAction, setPersonalAreaAction] =
    useState<PersonalAreaAction | null>(null);
  const [pendingReturnRoute, setPendingReturnRoute] =
    useState<StockAdminRoute | null>(null);
  const liveMemberIdentity = useMemberIdentity(activeRoute);
  const memberIdentity = localPersonalPreview
    ? { initials: "CV", isAuthenticated: true, isStockAdmin: false }
    : liveMemberIdentity;

  useEffect(() => {
    function syncFromHash() {
      setActiveRoute(readInitialRoute());
      setIsAccountMenuOpen(false);
      setPendingReturnRoute(null);
    }

    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("popstate", syncFromHash);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("popstate", syncFromHash);
    };
  }, []);

  useEffect(() => {
    if (
      !liveMemberIdentity.isAuthenticated ||
      pendingReturnRoute !== "stock-admin"
    ) {
      return;
    }

    if (window.location.hash !== PERSONAL_ROUTE_HASH) {
      setPendingReturnRoute(null);
      return;
    }

    setPendingReturnRoute(null);
    setIsAccountMenuOpen(false);
    setPersonalAreaAction(null);
    setActiveRoute("stock-admin");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${
        localPersonalPreview ? window.location.search : ""
      }${SHIRT_STOCK_ADMIN_ROUTE_HASH}`,
    );
  }, [
    liveMemberIdentity.isAuthenticated,
    localPersonalPreview,
    pendingReturnRoute,
  ]);

  function handleTabChange(tab: TabId) {
    setIsAccountMenuOpen(false);
    setPersonalAreaAction(null);
    setPendingReturnRoute(null);
    setActiveRoute(tab);
    const nextHash =
      tab === "home"
        ? HOME_ROUTE_HASH
        : tab === "membership"
          ? memberIdentity.isAuthenticated
            ? PERSONAL_ROUTE_HASH
            : SIGNUP_ROUTE_HASH
          : tab === "events"
            ? EVENTS_ROUTE_HASH
            : SHOP_ROUTE_HASH;

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${
        localPersonalPreview ? window.location.search : ""
      }${nextHash}`,
    );
  }

  function openPersonalArea(
    action: PersonalAreaAction,
    returnRoute: StockAdminRoute | null = null,
  ) {
    const nextHash =
      action === "signup" ? SIGNUP_ROUTE_HASH : PERSONAL_ROUTE_HASH;
    setPendingReturnRoute(returnRoute);
    setPersonalAreaAction(action);
    setActiveRoute("membership");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${
        localPersonalPreview ? window.location.search : ""
      }${nextHash}`,
    );
  }

  function openLatestNews() {
    setIsAccountMenuOpen(false);
    setPendingReturnRoute(null);
    setActiveRoute("news-article");
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${NEWS_ARTICLE_ROUTE_HASH}`,
    );
  }

  async function handleAccountMenuAction(action: AccountMenuAction) {
    setIsAccountMenuOpen(false);

    if (action === "stock-admin") {
      setPendingReturnRoute(null);
      setPersonalAreaAction(null);
      setActiveRoute("stock-admin");
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${SHIRT_STOCK_ADMIN_ROUTE_HASH}`,
      );
      return;
    }

    if (action === "signout") {
      setPendingReturnRoute(null);

      if (localPersonalPreview) {
        return;
      }

      setPersonalAreaAction(null);
      const client = await getSupabaseClient();
      await client?.auth.signOut();
      return;
    }

    openPersonalArea(action);
  }

  return (
    <main className="app-shell">
      <div className="phone-viewport">
        {activeRoute === "home" && (
          <HomeScreen
            identity={memberIdentity}
            isAccountMenuOpen={isAccountMenuOpen}
            onAvatarClick={() => setIsAccountMenuOpen((current) => !current)}
            onNavigate={handleTabChange}
            onOpenLatestNews={openLatestNews}
          />
        )}
        {activeRoute === "news-article" && (
          <NewsArticleScreen onBack={() => handleTabChange("home")} />
        )}
        {activeRoute === "membership" && (
          <AuthScreen
            demoMode={localPersonalPreview}
            identityInitials={memberIdentity.initials}
            isAccountMenuOpen={isAccountMenuOpen}
            onAvatarClick={() => setIsAccountMenuOpen((current) => !current)}
            onRequestedActionHandled={() => setPersonalAreaAction(null)}
            requestedAction={personalAreaAction}
          />
        )}
        {activeRoute === "events" && (
          <EventsScreen
            identity={memberIdentity}
            isAccountMenuOpen={isAccountMenuOpen}
            onAvatarClick={() => setIsAccountMenuOpen((current) => !current)}
          />
        )}
        {activeRoute === "shop" && (
          <ShopScreen
            identity={memberIdentity}
            isAccountMenuOpen={isAccountMenuOpen}
            onAvatarClick={() => setIsAccountMenuOpen((current) => !current)}
          />
        )}
        {activeRoute === "reservation" && (
          <GuestReservationScreen onBack={() => handleTabChange("shop")} />
        )}
        {activeRoute === "privacy" && <LegalScreen />}
        {activeRoute === "stock-admin" && (
          <StockAdminScreen
            isAuthenticated={liveMemberIdentity.isAuthenticated}
            onBack={() => handleTabChange("home")}
            onSignIn={() => openPersonalArea("signin", "stock-admin")}
          />
        )}
        {isAccountMenuOpen && (
          <AccountMenu
            isAuthenticated={memberIdentity.isAuthenticated}
            isStockAdmin={memberIdentity.isStockAdmin}
            onAction={(action) => void handleAccountMenuAction(action)}
            onClose={() => setIsAccountMenuOpen(false)}
          />
        )}
        {activeRoute !== "stock-admin" && (
          <BottomNav
            activeTab={
              activeRoute === "events" ||
              activeRoute === "shop" ||
              activeRoute === "reservation"
                ? activeRoute === "reservation"
                  ? "shop"
                  : activeRoute
                : activeRoute === "home" || activeRoute === "news-article"
                  ? "home"
                  : "membership"
            }
            isAuthenticated={memberIdentity.isAuthenticated}
            onChange={handleTabChange}
          />
        )}
      </div>
    </main>
  );
}
