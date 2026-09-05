import { useEffect, useState } from "react";
import {
  fetchShirtStockAvailability,
  type ShirtStockAvailability,
} from "../lib/shirtReservations";
import { getSupabaseClient } from "../lib/supabase";

export function useShirtStockAvailability(enabled = true) {
  const [stockAvailability, setStockAvailability] = useState<
    ShirtStockAvailability[]
  >([]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isActive = true;

    async function loadStockAvailability() {
      try {
        const client = await getSupabaseClient();

        if (!client) {
          return;
        }

        const nextStockAvailability = await fetchShirtStockAvailability(client);

        if (isActive) {
          setStockAvailability(nextStockAvailability);
        }
      } catch {
        // Stock messaging is best-effort if the availability endpoint is down.
      }
    }

    void loadStockAvailability();

    return () => {
      isActive = false;
    };
  }, [enabled]);

  return stockAvailability;
}
