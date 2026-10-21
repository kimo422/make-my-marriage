// Client-safe response types for /api/me.

export interface MeUser {
  id: string;
  name: string;
  email: string;
}

/** One wedding the user belongs to. Filled in when weddings land in Phase 2. */
export interface MeWedding {
  id: string;
  brideName: string;
  groomName: string;
  primaryDate: string;
  role: "owner" | "manager" | "organizer" | "viewer";
  side: "bride" | "groom" | "both";
}

export interface MeResponse {
  user: MeUser;
  weddings: MeWedding[];
}
