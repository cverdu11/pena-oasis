import type { SupabaseClient } from "@supabase/supabase-js";

export type AttendanceAnswer = "attending" | "not-attending" | null;

export type EventAttendanceResponse = {
  answer: AttendanceAnswer;
  isPrivate: boolean;
};

export type SavedEventAttendanceResponse = {
  answer: Exclude<AttendanceAnswer, null>;
  isPrivate: boolean;
};

type EventAttendanceCountRow = {
  event_id: string;
  attendee_count: number | string;
};

type EventAttendanceResponseRow = {
  event_id: string;
  attending: boolean;
  is_private: boolean;
};

const EVENT_ATTENDANCE_TABLE = "event_attendance_responses";

export const EMPTY_EVENT_RESPONSE: EventAttendanceResponse = {
  answer: null,
  isPrivate: false,
};

export async function fetchEventAttendanceCounts(
  client: SupabaseClient,
  eventIds: string[],
) {
  if (eventIds.length === 0) {
    return {};
  }

  const counts = Object.fromEntries(eventIds.map((eventId) => [eventId, 0]));
  const { data, error } = await client.rpc("get_event_attendance_counts", {
    requested_event_ids: eventIds,
  });

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as EventAttendanceCountRow[]) {
    if (row.event_id in counts) {
      counts[row.event_id] = Number(row.attendee_count);
    }
  }

  return counts;
}

export async function fetchUserEventResponses(
  client: SupabaseClient,
  userId: string,
  eventIds: string[],
) {
  if (eventIds.length === 0) {
    return {};
  }

  const responses: Record<string, EventAttendanceResponse> = {};
  const { data, error } = await client
    .from(EVENT_ATTENDANCE_TABLE)
    .select("event_id, attending, is_private")
    .eq("user_id", userId)
    .in("event_id", eventIds);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as EventAttendanceResponseRow[]) {
    responses[row.event_id] = {
      answer: row.attending ? "attending" : "not-attending",
      isPrivate: row.is_private,
    };
  }

  return responses;
}

export async function saveUserEventResponse(
  client: SupabaseClient,
  eventId: string,
  userId: string,
  response: SavedEventAttendanceResponse,
) {
  const { error } = await client.from(EVENT_ATTENDANCE_TABLE).upsert(
    {
      event_id: eventId,
      user_id: userId,
      attending: response.answer === "attending",
      is_private: response.isPrivate,
    },
    { onConflict: "event_id,user_id" },
  );

  if (error) {
    throw error;
  }
}
