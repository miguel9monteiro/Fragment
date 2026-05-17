export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alert_preferences: {
        Row: {
          categories: Database["public"]["Enums"]["role_category"][]
          created_at: string
          email_enabled: boolean
          firm_ids: string[]
          id: string
          programmes: Database["public"]["Enums"]["programme_type"][]
          push_enabled: boolean
          push_subscription: Json | null
          uk_only: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: Database["public"]["Enums"]["role_category"][]
          created_at?: string
          email_enabled?: boolean
          firm_ids?: string[]
          id?: string
          programmes?: Database["public"]["Enums"]["programme_type"][]
          push_enabled?: boolean
          push_subscription?: Json | null
          uk_only?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: Database["public"]["Enums"]["role_category"][]
          created_at?: string
          email_enabled?: boolean
          firm_ids?: string[]
          id?: string
          programmes?: Database["public"]["Enums"]["programme_type"][]
          push_enabled?: boolean
          push_subscription?: Json | null
          uk_only?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applied_at: string | null
          cover_letter_document_id: string | null
          created_at: string
          cv_document_id: string | null
          id: string
          job_id: string
          notes: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          cover_letter_document_id?: string | null
          created_at?: string
          cv_document_id?: string | null
          id?: string
          job_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          cover_letter_document_id?: string | null
          created_at?: string
          cv_document_id?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_cover_letter_document_id_fkey"
            columns: ["cover_letter_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_cv_document_id_fkey"
            columns: ["cv_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_digests: {
        Row: {
          digest_date: string
          generated_at: string
          id: number
          rendered_text: string | null
          sent_via: string[]
          summary: Json
        }
        Insert: {
          digest_date: string
          generated_at?: string
          id?: number
          rendered_text?: string | null
          sent_via?: string[]
          summary: Json
        }
        Update: {
          digest_date?: string
          generated_at?: string
          id?: number
          rendered_text?: string | null
          sent_via?: string[]
          summary?: Json
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["document_kind"]
          label: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["document_kind"]
          label: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["document_kind"]
          label?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      firm_careers_snapshots: {
        Row: {
          ats_signals: string[]
          content_hash: string | null
          external_hosts: string[]
          firm_id: string | null
          firm_slug: string | null
          id: number
          signals_hash: string | null
          snapshot_at: string
          status_code: number | null
          url: string
        }
        Insert: {
          ats_signals?: string[]
          content_hash?: string | null
          external_hosts?: string[]
          firm_id?: string | null
          firm_slug?: string | null
          id?: number
          signals_hash?: string | null
          snapshot_at?: string
          status_code?: number | null
          url: string
        }
        Update: {
          ats_signals?: string[]
          content_hash?: string | null
          external_hosts?: string[]
          firm_id?: string | null
          firm_slug?: string | null
          id?: number
          signals_hash?: string | null
          snapshot_at?: string
          status_code?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_careers_snapshots_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_volume_snapshots: {
        Row: {
          firm_id: string | null
          firm_slug: string | null
          id: number
          open_count: number
          snapshot_at: string
        }
        Insert: {
          firm_id?: string | null
          firm_slug?: string | null
          id?: number
          open_count: number
          snapshot_at?: string
        }
        Update: {
          firm_id?: string | null
          firm_slug?: string | null
          id?: number
          open_count?: number
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_volume_snapshots_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          active: boolean
          ats: Database["public"]["Enums"]["ats_type"]
          ats_config: Json
          careers_url: string | null
          consecutive_errors: number
          created_at: string
          id: string
          last_error_at: string | null
          last_success_at: string | null
          logo_url: string | null
          name: string
          next_run_after: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          ats: Database["public"]["Enums"]["ats_type"]
          ats_config?: Json
          careers_url?: string | null
          consecutive_errors?: number
          created_at?: string
          id?: string
          last_error_at?: string | null
          last_success_at?: string | null
          logo_url?: string | null
          name: string
          next_run_after?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          ats?: Database["public"]["Enums"]["ats_type"]
          ats_config?: Json
          careers_url?: string | null
          consecutive_errors?: number
          created_at?: string
          id?: string
          last_error_at?: string | null
          last_success_at?: string | null
          logo_url?: string | null
          name?: string
          next_run_after?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          apply_url: string
          category: Database["public"]["Enums"]["role_category"]
          closed_at: string | null
          created_at: string
          detected_at: string
          external_id: string
          firm_id: string
          id: string
          location: string | null
          posted_at: string | null
          programme: Database["public"]["Enums"]["programme_type"]
          raw: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          apply_url: string
          category?: Database["public"]["Enums"]["role_category"]
          closed_at?: string | null
          created_at?: string
          detected_at?: string
          external_id: string
          firm_id: string
          id?: string
          location?: string | null
          posted_at?: string | null
          programme?: Database["public"]["Enums"]["programme_type"]
          raw?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          apply_url?: string
          category?: Database["public"]["Enums"]["role_category"]
          closed_at?: string | null
          created_at?: string
          detected_at?: string
          external_id?: string
          firm_id?: string
          id?: string
          location?: string | null
          posted_at?: string | null
          programme?: Database["public"]["Enums"]["programme_type"]
          raw?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      poller_runs: {
        Row: {
          closed: number
          error: string | null
          fetched: number
          firm_id: string | null
          firm_slug: string | null
          id: number
          ms: number
          ran_at: string
          source: string
          uk: number
          upserted: number
        }
        Insert: {
          closed?: number
          error?: string | null
          fetched?: number
          firm_id?: string | null
          firm_slug?: string | null
          id?: number
          ms?: number
          ran_at?: string
          source: string
          uk?: number
          upserted?: number
        }
        Update: {
          closed?: number
          error?: string | null
          fetched?: number
          firm_id?: string | null
          firm_slug?: string | null
          id?: number
          ms?: number
          ran_at?: string
          source?: string
          uk?: number
          upserted?: number
        }
        Relationships: [
          {
            foreignKeyName: "poller_runs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          acknowledged_at: string | null
          detail: Json | null
          firm_id: string | null
          id: number
          kind: string
          level: string
          message: string
          raised_at: string
          resolved_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          detail?: Json | null
          firm_id?: string | null
          id?: number
          kind: string
          level: string
          message: string
          raised_at?: string
          resolved_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          detail?: Json | null
          firm_id?: string | null
          id?: number
          kind?: string
          level?: string
          message?: string
          raised_at?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_alerts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _invoke_poller: { Args: { fn: string }; Returns: number }
      close_stale_jobs: {
        Args: { p_firm_id: string; p_seen: string[] }
        Returns: number
      }
      firm_open_counts_for_admin: {
        Args: never
        Returns: {
          firm_id: string
          open_count: number
        }[]
      }
      prune_poller_runs: { Args: { p_days?: number }; Returns: number }
      snapshot_firm_volumes: { Args: never; Returns: number }
      update_firm_run_states: { Args: { p_updates: Json }; Returns: number }
      watchdog_firm_zero_uk_candidates: {
        Args: { p_min_runs?: number; p_since: string }
        Returns: {
          fetched: number
          firm_id: string
          firm_slug: string
          runs: number
          source: string
          uk: number
        }[]
      }
      watchdog_volume_drop_candidates: {
        Args: {
          p_drop_factor?: number
          p_min_baseline?: number
          p_min_samples?: number
          p_since: string
        }
        Returns: {
          baseline_p50: number
          current_count: number
          firm_id: string
          firm_slug: string
          samples: number
        }[]
      }
    }
    Enums: {
      application_status:
        | "saved"
        | "started"
        | "submitted"
        | "online_assessment"
        | "video_interview"
        | "first_round"
        | "assessment_centre"
        | "final_round"
        | "offer"
        | "rejected"
        | "withdrawn"
      ats_type:
        | "workday"
        | "avature"
        | "smartrecruiters"
        | "greenhouse"
        | "lever"
        | "custom_html"
        | "workable"
        | "teamtailor"
        | "oracle_hcm"
        | "oleeo"
        | "eightfold"
      document_kind: "cv" | "cover_letter"
      programme_type:
        | "spring_week"
        | "summer_internship"
        | "off_cycle_internship"
        | "industrial_placement"
        | "graduate"
        | "experienced"
        | "unknown"
        | "entry_level"
        | "mid_level"
        | "senior"
      role_category:
        | "investment_banking"
        | "sales_trading"
        | "asset_management"
        | "private_equity"
        | "hedge_fund"
        | "private_credit"
        | "wealth_management"
        | "research"
        | "risk"
        | "quant"
        | "other"
        | "risk_compliance"
        | "technology"
        | "corporate_functions"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      application_status: [
        "saved",
        "started",
        "submitted",
        "online_assessment",
        "video_interview",
        "first_round",
        "assessment_centre",
        "final_round",
        "offer",
        "rejected",
        "withdrawn",
      ],
      ats_type: [
        "workday",
        "avature",
        "smartrecruiters",
        "greenhouse",
        "lever",
        "custom_html",
        "workable",
        "teamtailor",
        "oracle_hcm",
        "oleeo",
        "eightfold",
      ],
      document_kind: ["cv", "cover_letter"],
      programme_type: [
        "spring_week",
        "summer_internship",
        "off_cycle_internship",
        "industrial_placement",
        "graduate",
        "experienced",
        "unknown",
        "entry_level",
        "mid_level",
        "senior",
      ],
      role_category: [
        "investment_banking",
        "sales_trading",
        "asset_management",
        "private_equity",
        "hedge_fund",
        "private_credit",
        "wealth_management",
        "research",
        "risk",
        "quant",
        "other",
        "risk_compliance",
        "technology",
        "corporate_functions",
      ],
    },
  },
} as const
