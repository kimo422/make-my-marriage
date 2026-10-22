import { describe, expect, it } from "vitest";

import { can, type Permission, type Role } from "@/modules/members/permissions";

// The PRD/API Design matrix, written out by hand so a change to PERMISSIONS
// has to be made deliberately in two places.
const matrix: Record<Permission, Record<Role, boolean>> = {
  "wedding.view": { owner: true, manager: true, organizer: true, viewer: true },
  "wedding.edit": { owner: true, manager: true, organizer: false, viewer: false },
  "wedding.delete": { owner: true, manager: false, organizer: false, viewer: false },
  "members.view": { owner: true, manager: true, organizer: true, viewer: true },
  "members.manage": { owner: true, manager: true, organizer: false, viewer: false },
  "members.manageOwners": { owner: true, manager: false, organizer: false, viewer: false },
  "activity.view": { owner: true, manager: true, organizer: true, viewer: true },
  "events.edit": { owner: true, manager: true, organizer: false, viewer: false },
  "tasks.edit": { owner: true, manager: true, organizer: true, viewer: false },
  "guests.edit": { owner: true, manager: true, organizer: true, viewer: false },
  "guests.viewContacts": { owner: true, manager: true, organizer: true, viewer: false },
  "rsvps.view": { owner: true, manager: true, organizer: true, viewer: true },
  "rsvps.export": { owner: true, manager: true, organizer: false, viewer: false },
  "website.edit": { owner: true, manager: true, organizer: false, viewer: false },
  "gallery.moderate": { owner: true, manager: true, organizer: false, viewer: false },
};

describe("role matrix", () => {
  for (const [permission, roles] of Object.entries(matrix) as [
    Permission,
    Record<Role, boolean>,
  ][]) {
    for (const [role, allowed] of Object.entries(roles) as [Role, boolean][]) {
      it(`${role} ${allowed ? "can" : "cannot"} ${permission}`, () => {
        expect(can(role, permission)).toBe(allowed);
      });
    }
  }
});
