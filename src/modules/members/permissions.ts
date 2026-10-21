// The role matrix (PRD "Users, roles and permissions", API Design "Permission
// matrix", and the planning decisions) as data. Client-safe: the UI uses it to
// hide actions a role can't take; the server enforces it in requireMember().

export const ROLES = ["owner", "manager", "organizer", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const SIDES = ["bride", "groom", "both"] as const;
export type Side = (typeof SIDES)[number];

const ALL: readonly Role[] = ROLES;
const PLANNERS: readonly Role[] = ["owner", "manager"];

export const PERMISSIONS = {
  "wedding.view": ALL,
  "wedding.edit": PLANNERS,
  "wedding.delete": ["owner"],
  "members.view": ALL,
  /** Invite, re-role and remove members below owner. Changing owners needs `members.manageOwners`. */
  "members.manage": PLANNERS,
  "members.manageOwners": ["owner"],
  "activity.view": ALL,
  "events.edit": PLANNERS,
  /** Decision 6: organizers can create and edit any task. */
  "tasks.edit": ["owner", "manager", "organizer"],
  /** Organizers are limited to their own side by the guests service. */
  "guests.edit": ["owner", "manager", "organizer"],
  /** Decision 6: viewers see RSVP counts but never guest phones or emails. */
  "guests.viewContacts": ["owner", "manager", "organizer"],
  "rsvps.view": ALL,
  "website.edit": PLANNERS,
  "gallery.moderate": PLANNERS,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Wedding manager",
  organizer: "Organizer",
  viewer: "Viewer",
};

export const SIDE_LABELS: Record<Side, string> = {
  bride: "Bride's side",
  groom: "Groom's side",
  both: "Both sides",
};
