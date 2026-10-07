export const queryKeys = {
  reservations: {
    all: ["reservations"] as const,

    recent: (limit: number) => ["reservations", "recent", limit] as const,
  },

  rooms: {
    status: ["rooms", "status"] as const,
  },

  escalations: {
    recent: ["escalations", "recent"] as const,
  },
} as const;
