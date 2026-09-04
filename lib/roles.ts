import type { RoleName } from '@/types/database';

/** Canonical role names, mirroring the `roles` seed table. */
export const ROLES = {
  STUDENT: 'student',
  GRADUATE: 'graduate',
  ADMIN: 'admin',
  HOD: 'hod',
  PROCTOR: 'proctor',
  FEMALE_FOCAL_PERSON: 'female_focal_person',
  HOSTEL_WARDEN: 'hostel_warden',
  COUNSELOR: 'counselor',
} as const satisfies Record<string, RoleName>;

/** Roles permitted to read audit logs / oversight surfaces. */
export const STAFF_ROLES: RoleName[] = [
  ROLES.ADMIN,
  ROLES.HOD,
  ROLES.PROCTOR,
  ROLES.FEMALE_FOCAL_PERSON,
  ROLES.HOSTEL_WARDEN,
  ROLES.COUNSELOR,
];

/** Roles that verified students/graduates can request through the authority workflow. */
export const AUTHORITY_REQUESTABLE_ROLES: RoleName[] = [
  ROLES.HOD,
  ROLES.PROCTOR,
  ROLES.FEMALE_FOCAL_PERSON,
  ROLES.HOSTEL_WARDEN,
  ROLES.COUNSELOR,
];

const ROLE_LABELS: Record<RoleName, string> = {
  student: 'Student',
  graduate: 'Graduate',
  admin: 'Administrator',
  hod: 'Head of Department',
  proctor: 'Proctor',
  female_focal_person: 'Female Focal Person',
  hostel_warden: 'Hostel Warden',
  counselor: 'Counselor',
};

export function roleLabel(role: RoleName | string): string {
  return ROLE_LABELS[role as RoleName] ?? role;
}

export function hasRole(roles: RoleName[], role: RoleName): boolean {
  return roles.includes(role);
}

export function isStaff(roles: RoleName[]): boolean {
  return roles.some((role) => STAFF_ROLES.includes(role));
}

/** The single most descriptive role to show in a badge. */
export function primaryRole(roles: RoleName[]): RoleName {
  const precedence: RoleName[] = [
    ROLES.ADMIN,
    ROLES.HOD,
    ROLES.PROCTOR,
    ROLES.FEMALE_FOCAL_PERSON,
    ROLES.COUNSELOR,
    ROLES.HOSTEL_WARDEN,
    ROLES.GRADUATE,
    ROLES.STUDENT,
  ];
  return precedence.find((role) => roles.includes(role)) ?? ROLES.STUDENT;
}
