import type { MyWeddingDto } from "@/modules/weddings/types";

// Client-safe response types for /api/me.

export interface MeUser {
  id: string;
  name: string;
  email: string;
}

export interface MeResponse {
  user: MeUser;
  /** Includes owners' deleted weddings still inside the 30-day restore window (deletedAt set). */
  weddings: MyWeddingDto[];
}
