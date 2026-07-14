import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";

type IdentityProfile = {
  first_name: string | null;
  full_name: string | null;
  last_name: string | null;
};

export type MemberIdentity = {
  initials: string;
  isAuthenticated: boolean;
};

const guestIdentity: MemberIdentity = {
  initials: "PO",
  isAuthenticated: false,
};

function getUserName(user: User) {
  const metadataName = [
    user.user_metadata?.full_name,
    user.user_metadata?.name,
  ].find(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );

  return metadataName?.trim() || user.email?.split("@")[0] || "Socio";
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const firstInitial = parts[0]?.[0] ?? "P";
  const lastInitial = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";

  return `${firstInitial}${lastInitial}`.toUpperCase();
}

function createIdentity(user: User, profile?: IdentityProfile | null) {
  const profileName =
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const fullName = profileName || getUserName(user);

  return {
    initials: getInitials(fullName),
    isAuthenticated: true,
  } satisfies MemberIdentity;
}

export function useMemberIdentity(refreshKey: string) {
  const [identity, setIdentity] = useState<MemberIdentity>(guestIdentity);

  useEffect(() => {
    let isActive = true;
    let requestId = 0;
    let unsubscribe: (() => void) | undefined;

    async function syncIdentity(
      client: SupabaseClient,
      user: User | null,
    ) {
      const currentRequestId = ++requestId;

      if (!user) {
        if (isActive) {
          setIdentity(guestIdentity);
        }
        return;
      }

      if (isActive) {
        setIdentity(createIdentity(user));
      }

      const { data } = await client
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle<IdentityProfile>();

      if (isActive && currentRequestId === requestId) {
        setIdentity(createIdentity(user, data));
      }
    }

    async function startIdentitySync() {
      const client = await getSupabaseClient();

      if (!client) {
        if (isActive) {
          setIdentity(guestIdentity);
        }
        return;
      }

      const subscription = client.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => {
          if (isActive) {
            void syncIdentity(client, session?.user ?? null);
          }
        }, 0);
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();

      const { data } = await client.auth.getSession();
      await syncIdentity(client, data.session?.user ?? null);
    }

    void startIdentitySync();

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [refreshKey]);

  return identity;
}
