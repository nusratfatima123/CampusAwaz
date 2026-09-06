/**
 * Hand-maintained TypeScript types mirroring the Supabase schema defined in
 * `supabase/migrations/001_initial.sql`.
 *
 * Regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 *
 * IMPORTANT — declare row shapes below with `type X = { ... }`, never
 * `interface X { ... }`. Supabase's `GenericSchema` constraint requires each
 * table's Row/Insert/Update to be assignable to `Record<string, unknown>`.
 * An `interface` has no implicit index signature, so it fails that constraint;
 * TypeScript then falls back to `Schema = any` and every query result silently
 * degrades to `never` (e.g. "Property 'x' does not exist on type 'never'").
 */
export type AffiliationStatus =
  | 'unverified'
  | 'pending_email'
  | 'pending_card'
  | 'verified'
  | 'rejected';

export type StudentType = 'current_student' | 'graduate';

export type PrivacyMode = 'identified' | 'confidential' | 'anonymous';

export type VerificationMethod = 'email_otp' | 'student_card';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export type RoleName =
  | 'student'
  | 'graduate'
  | 'admin'
  | 'hod'
  | 'proctor'
  | 'female_focal_person'
  | 'hostel_warden'
  | 'counselor';

export type University = {
  id: string;
  name: string;
  code: string;
  country: string;
  allowed_email_domains: string[];
  is_active: boolean;
  created_at: string;
}

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  university_id: string | null;
  affiliation_status: AffiliationStatus;
  student_type: StudentType | null;
  privacy_mode: PrivacyMode;
  created_at: string;
  updated_at: string;
}

export type Role = {
  id: string;
  name: RoleName;
  description: string | null;
}

export type UserRole = {
  user_id: string;
  role_id: string;
  university_id: string | null;
}

export type OcrExtracted = {
  name?: string;
  roll_id?: string;
  university?: string;
  validity?: string;
}

export type UserVerification = {
  id: string;
  user_id: string;
  method: VerificationMethod;
  status: VerificationStatus;
  email_used: string | null;
  otp_hash: string | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  card_storage_path: string | null;
  ocr_extracted: OcrExtracted | null;
  ocr_confidence: number | null;
  needs_manual_review: boolean;
  reviewer_notes: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

export type AuditLog = {
  id: number;
  user_id: string | null;
  event: string;
  actor: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/** Profile joined with its university — the shape used across the auth shell. */
export interface ProfileWithUniversity extends Profile {
  universities: Pick<University, 'id' | 'name' | 'code' | 'allowed_email_domains'> | null;
}

// ---------------------------------------------------------------------------
// Sprint 2 — complaints
// ---------------------------------------------------------------------------

export type ComplaintCategoryKey =
  | 'academic'
  | 'facilities'
  | 'hostel'
  | 'financial'
  | 'administration'
  | 'safety_harassment'
  | 'mental_health'
  | 'other';

export type ComplaintStatus =
  | 'submitted'
  | 'assigned'
  | 'in_review'
  | 'action_taken'
  | 'resolved'
  | 'escalated'
  | 'reopened';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';

export type ComplaintCategory = {
  id: string;
  key: ComplaintCategoryKey;
  label: string;
  description: string | null;
  is_sensitive: boolean;
  display_order: number;
  is_active: boolean;
};

export type Complaint = {
  id: string;
  tracking_id: string;
  student_id: string;
  university_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  privacy_mode: PrivacyMode;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  is_sensitive: boolean;
  immediate_danger: boolean;
  submitted_at: string;
  updated_at: string;
  /** Sprint 3 — owning department after smart routing. */
  department_id: string | null;
  /** Sprint 3 — staff member the case is assigned to. */
  assigned_to: string | null;
};

export type ComplaintEvidence = {
  id: string;
  complaint_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  is_resolution_evidence: boolean;
  created_at: string;
};

export type ComplaintStatusHistory = {
  id: string;
  complaint_id: string;
  status: ComplaintStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
};

export type ComplaintPrivacy = {
  id: string;
  complaint_id: string;
  student_id: string;
  exposed_to: string[];
  anonymous_alias: string | null;
  created_at: string;
  updated_at: string;
};

export type SensitiveCaseAccess = {
  id: string;
  complaint_id: string;
  user_id: string;
  role: RoleName;
  assigned_at: string;
};

export type TrackingIdSequence = {
  university_id: string | null;
  year: number;
  last_number: number;
};

/** Complaint joined with its category — the shape rendered by the UI. */
export interface ComplaintWithCategory extends Complaint {
  complaint_categories: Pick<
    ComplaintCategory,
    'id' | 'key' | 'label' | 'is_sensitive'
  > | null;
}

// ---------------------------------------------------------------------------
// Sprint 3 — AI assistant & smart routing
// ---------------------------------------------------------------------------

/** Shared department key set seeded for every university. */
export type DepartmentKey =
  | 'academic_affairs'
  | 'examinations'
  | 'student_affairs'
  | 'facilities'
  | 'hostel'
  | 'finance'
  | 'administration'
  | 'safety_proctor'
  | 'counseling'
  | 'it_services';

export type AiSessionType = 'complaint_assist' | 'routing_review' | 'faq_assist';

export type Department = {
  id: string;
  university_id: string;
  key: DepartmentKey;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type DepartmentRouting = {
  id: string;
  university_id: string;
  category_key: string;
  department_key: DepartmentKey;
  priority: ComplaintPriority;
  is_active: boolean;
  created_at: string;
};

export type AiSession = {
  id: string;
  user_id: string;
  session_type: AiSessionType;
  raw_input: string;
  privacy_mode: PrivacyMode;
  created_at: string;
};

/** Admin correction applied on top of an AI recommendation. */
export type AiAdminOverride = {
  category_id?: string | null;
  priority?: ComplaintPriority | null;
  department_id?: string | null;
  reason?: string | null;
  overridden_by?: string;
  overridden_at?: string;
};

export type AiRecommendation = {
  id: string;
  complaint_id: string | null;
  session_id: string | null;
  category_id: string | null;
  category_key: string | null;
  category_confidence: number;
  subcategory: string | null;
  priority: ComplaintPriority;
  priority_confidence: number;
  department_id: string | null;
  department_key: string | null;
  department_confidence: number;
  structured_draft: string | null;
  overall_confidence: number;
  model_used: string | null;
  was_edited: boolean;
  admin_override: AiAdminOverride | null;
  created_at: string;
  updated_at: string;
};

export type NotificationType = 'status_change' | 'assignment' | 'resolution' | 'case_update' | 'escalation';

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  complaint_id: string | null;
  title: string;
  body: string | null;
  tracking_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type ComplaintAssignment = {
  id: string;
  complaint_id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  department_id: string | null;
  notes: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Sprint 5 — escalation, resolution & feedback
// ---------------------------------------------------------------------------

export type SlaRule = {
  id: string;
  university_id: string | null;
  category_key: string | null;
  priority: string | null;
  response_hours: number;
  escalation_level: number;
  is_active: boolean;
  created_at: string;
};

export type Escalation = {
  id: string;
  complaint_id: string;
  escalated_by: string | null;
  escalated_to: string | null;
  reason: string;
  previous_status: string | null;
  new_status: string;
  sla_rule_id: string | null;
  level: number;
  created_at: string;
};

export type ProofOfAction = {
  id: string;
  complaint_id: string;
  created_by: string;
  action_taken: string;
  resolution_explanation: string | null;
  created_at: string;
};

export type ResolutionEvidence = {
  id: string;
  complaint_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  created_at: string;
};

export type Feedback = {
  id: string;
  complaint_id: string;
  student_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type IdentityAccessRequestStatus =
  | 'pending'
  | 'admin_approved'
  | 'admin_denied'
  | 'granted'
  | 'denied'
  | 'expired';

export type IdentityAccessRequest = {
  id: string;
  complaint_id: string;
  requester_id: string;
  requested_by_role: string;
  status: IdentityAccessRequestStatus;
  admin_decided_by: string | null;
  admin_decided_at: string | null;
  admin_notes: string | null;
  student_decided_at: string | null;
  student_notes: string | null;
  granted_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SlaState = 'on_track' | 'approaching' | 'breached';

export type SlaDisplay = {
  state: SlaState;
  hoursRemaining: number;
  responseDeadline: string;
  responseHours: number;
};

// ---------------------------------------------------------------------------
// Sprint 6 — support, counseling, FAQ, policies, emergency & analytics
// ---------------------------------------------------------------------------

export type SupportResourceType =
  | 'mental_health'
  | 'student_rights'
  | 'policy'
  | 'faq'
  | 'emergency'
  | 'general';

export type SupportResource = {
  id: string;
  university_id: string | null;
  resource_type: SupportResourceType;
  title: string;
  description: string | null;
  url: string | null;
  phone: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type CounselingStatus = 'pending' | 'assigned' | 'in_progress' | 'completed';

export type CounselingRequest = {
  id: string;
  student_id: string;
  university_id: string;
  counselor_id: string | null;
  subject: string;
  message: string;
  status: CounselingStatus;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
};

export type FaqEntry = {
  id: string;
  university_id: string | null;
  question: string;
  answer: string;
  category_key: string | null;
  source_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type Policy = {
  id: string;
  university_id: string | null;
  title: string;
  description: string | null;
  document_url: string | null;
  category_key: string | null;
  effective_date: string | null;
  is_active: boolean;
  created_at: string;
};

export type EmergencyContact = {
  id: string;
  university_id: string | null;
  label: string;
  phone: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type AnalyticsCategoryCount = {
  categoryKey: string | null;
  categoryLabel: string | null;
  total: number;
};

export type AnalyticsDepartmentCount = {
  departmentKey: string | null;
  departmentName: string | null;
  total: number;
};

export type AnalyticsSummary = {
  byCategory: AnalyticsCategoryCount[];
  byDepartment: AnalyticsDepartmentCount[];
  avgResolutionHours: number | null;
  pendingCount: number;
  escalatedCount: number;
  resolutionRate: number;
  recurringFacilityIssues: AnalyticsCategoryCount[];
  totalFeedback: number;
  avgRating: number | null;
  totalEscalations: number;
};

// ---------------------------------------------------------------------------
// Sprint 7 — verified university authority system
// ---------------------------------------------------------------------------

export type AuthorityRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'reinstated';

export type AuthorityRequest = {
  id: string;
  user_id: string;
  university_id: string;
  role_id: string;
  department_id: string | null;
  status: AuthorityRequestStatus;
  statement: string;
  evidence_path: string | null;
  reviewed_by: string | null;
  review_reason: string | null;
  reviewed_at: string | null;
  suspended_by: string | null;
  suspension_reason: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Minimal Database interface for the Supabase client generics. Only the tables
 * touched in Sprints 1–6 are described.
 */
export interface Database {
  public: {
    Tables: {
      universities: {
        Row: University;
        Insert: Partial<University> & { name: string; code: string };
        Update: Partial<University>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      roles: {
        Row: Role;
        Insert: Partial<Role> & { name: RoleName };
        Update: Partial<Role>;
        Relationships: [];
      };
      user_roles: {
        Row: UserRole;
        Insert: UserRole;
        Update: Partial<UserRole>;
        Relationships: [];
      };
      user_verification: {
        Row: UserVerification;
        Insert: Partial<UserVerification> & {
          user_id: string;
          method: VerificationMethod;
          status: VerificationStatus;
        };
        Update: Partial<UserVerification>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<Partial<AuditLog>, 'id'> & { event: string };
        Update: Partial<AuditLog>;
        Relationships: [];
      };
      complaint_categories: {
        Row: ComplaintCategory;
        Insert: Partial<ComplaintCategory> & {
          key: ComplaintCategoryKey;
          label: string;
        };
        Update: Partial<ComplaintCategory>;
        Relationships: [];
      };
      complaints: {
        Row: Complaint;
        Insert: Partial<Complaint> & {
          tracking_id: string;
          student_id: string;
          title: string;
          description: string;
        };
        Update: Partial<Complaint>;
        Relationships: [];
      };
      complaint_evidence: {
        Row: ComplaintEvidence;
        Insert: Partial<ComplaintEvidence> & {
          complaint_id: string;
          uploaded_by: string;
          storage_path: string;
          file_name: string;
          file_type: string;
          file_size_bytes: number;
        };
        Update: Partial<ComplaintEvidence>;
        Relationships: [];
      };
      complaint_status_history: {
        Row: ComplaintStatusHistory;
        Insert: Partial<ComplaintStatusHistory> & {
          complaint_id: string;
          status: ComplaintStatus;
        };
        Update: Partial<ComplaintStatusHistory>;
        Relationships: [];
      };
      complaint_privacy: {
        Row: ComplaintPrivacy;
        Insert: Partial<ComplaintPrivacy> & {
          complaint_id: string;
          student_id: string;
        };
        Update: Partial<ComplaintPrivacy>;
        Relationships: [];
      };
      sensitive_case_access: {
        Row: SensitiveCaseAccess;
        Insert: Partial<SensitiveCaseAccess> & {
          complaint_id: string;
          user_id: string;
          role: RoleName;
        };
        Update: Partial<SensitiveCaseAccess>;
        Relationships: [];
      };
      tracking_id_sequences: {
        Row: TrackingIdSequence;
        Insert: TrackingIdSequence;
        Update: Partial<TrackingIdSequence>;
        Relationships: [];
      };
      departments: {
        Row: Department;
        Insert: Partial<Department> & {
          university_id: string;
          key: DepartmentKey;
          name: string;
        };
        Update: Partial<Department>;
        Relationships: [];
      };
      department_routing: {
        Row: DepartmentRouting;
        Insert: Partial<DepartmentRouting> & {
          university_id: string;
          category_key: string;
          department_key: DepartmentKey;
        };
        Update: Partial<DepartmentRouting>;
        Relationships: [];
      };
      ai_sessions: {
        Row: AiSession;
        Insert: Partial<AiSession> & {
          user_id: string;
          session_type: AiSessionType;
          raw_input: string;
        };
        Update: Partial<AiSession>;
        Relationships: [];
      };
      ai_recommendations: {
        Row: AiRecommendation;
        Insert: Partial<Omit<AiRecommendation, 'admin_override'>> & {
          category_confidence: number;
          priority: ComplaintPriority;
          priority_confidence: number;
          department_confidence: number;
          overall_confidence: number;
          admin_override?: AiAdminOverride | null;
        };
        Update: Partial<Omit<AiRecommendation, 'admin_override'>> & {
          admin_override?: AiAdminOverride | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification> & {
          user_id: string;
          type: NotificationType;
          title: string;
        };
        Update: Partial<Notification>;
        Relationships: [];
      };
      complaint_assignments: {
        Row: ComplaintAssignment;
        Insert: Partial<ComplaintAssignment> & {
          complaint_id: string;
        };
        Update: Partial<ComplaintAssignment>;
        Relationships: [];
      };
      sla_rules: {
        Row: SlaRule;
        Insert: Partial<SlaRule> & {
          response_hours: number;
        };
        Update: Partial<SlaRule>;
        Relationships: [];
      };
      escalations: {
        Row: Escalation;
        Insert: Partial<Escalation> & {
          complaint_id: string;
          reason: string;
        };
        Update: Partial<Escalation>;
        Relationships: [];
      };
      proof_of_action: {
        Row: ProofOfAction;
        Insert: Partial<ProofOfAction> & {
          complaint_id: string;
          created_by: string;
          action_taken: string;
        };
        Update: Partial<ProofOfAction>;
        Relationships: [];
      };
      resolution_evidence: {
        Row: ResolutionEvidence;
        Insert: Partial<ResolutionEvidence> & {
          complaint_id: string;
          uploaded_by: string;
          storage_path: string;
          file_name: string;
          file_type: string;
          file_size_bytes: number;
        };
        Update: Partial<ResolutionEvidence>;
        Relationships: [];
      };
      feedback: {
        Row: Feedback;
        Insert: Partial<Feedback> & {
          complaint_id: string;
          student_id: string;
          rating: number;
        };
        Update: Partial<Feedback>;
        Relationships: [];
      };
      support_resources: {
        Row: SupportResource;
        Insert: Partial<SupportResource> & {
          title: string;
        };
        Update: Partial<SupportResource>;
        Relationships: [];
      };
      counseling_requests: {
        Row: CounselingRequest;
        Insert: Partial<CounselingRequest> & {
          student_id: string;
          university_id: string;
          subject: string;
          message: string;
        };
        Update: Partial<CounselingRequest>;
        Relationships: [];
      };
      faq_entries: {
        Row: FaqEntry;
        Insert: Partial<FaqEntry> & {
          question: string;
          answer: string;
        };
        Update: Partial<FaqEntry>;
        Relationships: [];
      };
      policies: {
        Row: Policy;
        Insert: Partial<Policy> & {
          title: string;
        };
        Update: Partial<Policy>;
        Relationships: [];
      };
      emergency_contacts: {
        Row: EmergencyContact;
        Insert: Partial<EmergencyContact> & {
          label: string;
          phone: string;
        };
        Update: Partial<EmergencyContact>;
        Relationships: [];
      };
      authority_requests: {
        Row: AuthorityRequest;
        Insert: Partial<AuthorityRequest> & {
          user_id: string;
          university_id: string;
          role_id: string;
          statement: string;
        };
        Update: Partial<AuthorityRequest>;
        Relationships: [];
      };
      identity_access_requests: {
        Row: IdentityAccessRequest;
        Insert: Partial<IdentityAccessRequest> & {
          complaint_id: string;
          requester_id: string;
          requested_by_role: string;
        };
        Update: Partial<IdentityAccessRequest>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_staff: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      generate_tracking_id: {
        Args: { p_university_id: string; p_year: number };
        Returns: string;
      };
      has_sensitive_case_access: {
        Args: { p_complaint_id: string };
        Returns: boolean;
      };
      can_read_complaint: {
        Args: { p_complaint_id: string };
        Returns: boolean;
      };
      can_see_complaint_identity: {
        Args: { p_complaint_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
