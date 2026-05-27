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
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          can_create_championships: boolean
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          can_create_championships?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          can_create_championships?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          age_min: number | null
          age_rule_mode: string
          championship_id: string
          created_at: string
          description: string | null
          gender: Database["public"]["Enums"]["category_gender"]
          id: string
          max_slots: number
          name: string
          price_cents: number
          prize: string | null
          uniform_model: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_min?: number | null
          age_rule_mode?: string
          championship_id: string
          created_at?: string
          description?: string | null
          gender?: Database["public"]["Enums"]["category_gender"]
          id?: string
          max_slots: number
          name: string
          price_cents?: number
          prize?: string | null
          uniform_model?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_min?: number | null
          age_rule_mode?: string
          championship_id?: string
          created_at?: string
          description?: string | null
          gender?: Database["public"]["Enums"]["category_gender"]
          id?: string
          max_slots?: number
          name?: string
          price_cents?: number
          prize?: string | null
          uniform_model?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_admins: {
        Row: {
          championship_id: string
          created_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          championship_id: string
          created_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          championship_id?: string
          created_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "championship_admins_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      championships: {
        Row: {
          active: boolean
          cancellation_policy: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          location_url: string | null
          name: string
          policies: string | null
          regulations: string | null
          shirt_size_chart_urls: string[]
          shirt_size_guarantee_until: string | null
          slug: string
          start_date: string | null
          uniform_models: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          cancellation_policy?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          location_url?: string | null
          name: string
          policies?: string | null
          regulations?: string | null
          shirt_size_chart_urls?: string[]
          shirt_size_guarantee_until?: string | null
          slug: string
          start_date?: string | null
          uniform_models?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          cancellation_policy?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          location_url?: string | null
          name?: string
          policies?: string | null
          regulations?: string | null
          shirt_size_chart_urls?: string[]
          shirt_size_guarantee_until?: string | null
          slug?: string
          start_date?: string | null
          uniform_models?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          amount_cents: number | null
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          athlete1_birthdate: string | null
          athlete1_name: string
          athlete1_shirt_size: Database["public"]["Enums"]["shirt_size"]
          athlete1_shorts_size: Database["public"]["Enums"]["shirt_size"]
          athlete2_birthdate: string | null
          athlete2_name: string
          athlete2_shirt_size: Database["public"]["Enums"]["shirt_size"]
          athlete2_shorts_size: Database["public"]["Enums"]["shirt_size"]
          category_id: string
          contact_email: string
          contact_phone: string
          created_at: string
          id: string
          installments: number
          last_email_sent_at: string | null
          manual_confirmation_note: string | null
          manual_confirmation_reason: string | null
          payer_cpf: string | null
          payer_postal_code: string | null
          payment_id: string | null
          payment_method: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          status: Database["public"]["Enums"]["registration_status"]
          team_name: string
          terms_accepted: boolean
          terms_accepted_at: string | null
          updated_at: string
          voucher_code: string
        }
        Insert: {
          amount_cents?: number | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          athlete1_birthdate?: string | null
          athlete1_name: string
          athlete1_shirt_size: Database["public"]["Enums"]["shirt_size"]
          athlete1_shorts_size: Database["public"]["Enums"]["shirt_size"]
          athlete2_birthdate?: string | null
          athlete2_name: string
          athlete2_shirt_size: Database["public"]["Enums"]["shirt_size"]
          athlete2_shorts_size: Database["public"]["Enums"]["shirt_size"]
          category_id: string
          contact_email: string
          contact_phone?: string
          created_at?: string
          id?: string
          installments?: number
          last_email_sent_at?: string | null
          manual_confirmation_note?: string | null
          manual_confirmation_reason?: string | null
          payer_cpf?: string | null
          payer_postal_code?: string | null
          payment_id?: string | null
          payment_method?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          team_name?: string
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          voucher_code: string
        }
        Update: {
          amount_cents?: number | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          athlete1_birthdate?: string | null
          athlete1_name?: string
          athlete1_shirt_size?: Database["public"]["Enums"]["shirt_size"]
          athlete1_shorts_size?: Database["public"]["Enums"]["shirt_size"]
          athlete2_birthdate?: string | null
          athlete2_name?: string
          athlete2_shirt_size?: Database["public"]["Enums"]["shirt_size"]
          athlete2_shorts_size?: Database["public"]["Enums"]["shirt_size"]
          category_id?: string
          contact_email?: string
          contact_phone?: string
          created_at?: string
          id?: string
          installments?: number
          last_email_sent_at?: string | null
          manual_confirmation_note?: string | null
          manual_confirmation_reason?: string | null
          payer_cpf?: string | null
          payer_postal_code?: string | null
          payment_id?: string | null
          payment_method?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          team_name?: string
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          voucher_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_championships: {
        Row: {
          championship_id: string
          created_at: string
          id: string
          staff_id: string
        }
        Insert: {
          championship_id: string
          created_at?: string
          id?: string
          staff_id: string
        }
        Update: {
          championship_id?: string
          created_at?: string
          id?: string
          staff_id?: string
        }
        Relationships: []
      }
      staff_fees: {
        Row: {
          amount_cents: number
          championship_id: string
          created_at: string
          created_by: string | null
          created_by_role: Database["public"]["Enums"]["fee_creator_role"]
          description: string
          id: string
          paid_at: string | null
          paid_by: string | null
          receipt_path: string | null
          staff_id: string
          status: Database["public"]["Enums"]["fee_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          championship_id: string
          created_at?: string
          created_by?: string | null
          created_by_role: Database["public"]["Enums"]["fee_creator_role"]
          description?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          receipt_path?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["fee_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          championship_id?: string
          created_at?: string
          created_by?: string | null
          created_by_role?: Database["public"]["Enums"]["fee_creator_role"]
          description?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          receipt_path?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["fee_status"]
          updated_at?: string
        }
        Relationships: []
      }
      staff_invites: {
        Row: {
          active: boolean
          championship_id: string | null
          created_at: string
          id: string
          owner_admin_id: string
          token: string
        }
        Insert: {
          active?: boolean
          championship_id?: string | null
          created_at?: string
          id?: string
          owner_admin_id: string
          token: string
        }
        Update: {
          active?: boolean
          championship_id?: string | null
          created_at?: string
          id?: string
          owner_admin_id?: string
          token?: string
        }
        Relationships: []
      }
      staff_reimbursements: {
        Row: {
          amount_cents: number
          category: Database["public"]["Enums"]["reimbursement_category"]
          championship_id: string
          created_at: string
          description: string
          expense_date: string
          id: string
          paid_at: string | null
          paid_by: string | null
          receipt_path: string | null
          staff_id: string
          status: Database["public"]["Enums"]["reimbursement_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category: Database["public"]["Enums"]["reimbursement_category"]
          championship_id: string
          created_at?: string
          description: string
          expense_date: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          receipt_path?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["reimbursement_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: Database["public"]["Enums"]["reimbursement_category"]
          championship_id?: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          receipt_path?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["reimbursement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_reimbursements_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_reimbursements_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staffs"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_sessions: {
        Row: {
          created_at: string
          expires_at: string
          staff_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          staff_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          staff_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_sessions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staffs"
            referencedColumns: ["id"]
          },
        ]
      }
      staffs: {
        Row: {
          birthdate: string
          contact_email: string | null
          contact_phone: string | null
          cpf: string
          created_at: string
          id: string
          name: string
          owner_admin_id: string
          pix_key: string
          pix_key_type: Database["public"]["Enums"]["pix_key_type"]
          rg: string
          updated_at: string
        }
        Insert: {
          birthdate: string
          contact_email?: string | null
          contact_phone?: string | null
          cpf: string
          created_at?: string
          id?: string
          name: string
          owner_admin_id: string
          pix_key: string
          pix_key_type: Database["public"]["Enums"]["pix_key_type"]
          rg: string
          updated_at?: string
        }
        Update: {
          birthdate?: string
          contact_email?: string | null
          contact_phone?: string | null
          cpf?: string
          created_at?: string
          id?: string
          name?: string
          owner_admin_id?: string
          pix_key?: string
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"]
          rg?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_championship: { Args: { _user_id: string }; Returns: boolean }
      can_view_championship: {
        Args: { _championship_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_registration: { Args: { _id: string }; Returns: undefined }
      confirm_registration:
        | { Args: { _id: string }; Returns: undefined }
        | {
            Args: { _id: string; _note?: string; _reason?: string }
            Returns: undefined
          }
      confirm_registration_by_payment: {
        Args: { _payment_id: string; _registration_id: string }
        Returns: undefined
      }
      create_registration: { Args: { payload: Json }; Returns: Json }
      dashboard_stats: {
        Args: { _championship_id?: string }
        Returns: {
          cancelled: number
          confirmed: number
          pending: number
          revenue_cents: number
          total: number
        }[]
      }
      generate_voucher_code: { Args: never; Returns: string }
      get_category_availability: {
        Args: { _category_id: string }
        Returns: number
      }
      get_registration_by_voucher: { Args: { _code: string }; Returns: Json }
      grant_championship_admin: {
        Args: { _championship_id: string; _email: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_admins: {
        Args: never
        Returns: {
          can_create: boolean
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      list_championship_admins: {
        Args: { _championship_id: string }
        Returns: {
          created_at: string
          email: string
          granted_by: string
          user_id: string
        }[]
      }
      list_manageable_championships: {
        Args: never
        Returns: {
          active: boolean
          cancellation_policy: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          location_url: string | null
          name: string
          policies: string | null
          regulations: string | null
          shirt_size_chart_urls: string[]
          shirt_size_guarantee_until: string | null
          slug: string
          start_date: string | null
          uniform_models: string[]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "championships"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      promote_user_to_admin: { Args: { _email: string }; Returns: Json }
      release_expired_registrations: { Args: never; Returns: number }
      revoke_admin: { Args: { _user_id: string }; Returns: undefined }
      revoke_championship_admin: {
        Args: { _championship_id: string; _user_id: string }
        Returns: undefined
      }
      set_admin_can_create: {
        Args: { _user_id: string; _value: boolean }
        Returns: undefined
      }
      set_registration_payer: {
        Args: {
          _cpf: string
          _id: string
          _installments: number
          _payment_method: string
          _postal_code: string
        }
        Returns: undefined
      }
      set_registration_pix: {
        Args: {
          _amount_cents: number
          _customer_id: string
          _expires_at: string
          _id: string
          _payment_id: string
          _qr: string
          _qr_b64: string
        }
        Returns: undefined
      }
      set_registration_processing: {
        Args: { _payment_id: string; _registration_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "master"
      category_gender: "male" | "female" | "mixed"
      fee_creator_role: "staff" | "admin"
      fee_status: "pending" | "paid"
      pix_key_type: "cpf" | "email" | "phone" | "random"
      registration_status: "pending" | "confirmed" | "cancelled" | "processing"
      reimbursement_category:
        | "alimentacao"
        | "transporte"
        | "passagem"
        | "gasolina"
        | "hospedagem"
        | "outro"
      reimbursement_status: "pending" | "paid"
      shirt_size: "P" | "M" | "G" | "GG" | "XG"
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
  public: {
    Enums: {
      app_role: ["admin", "master"],
      category_gender: ["male", "female", "mixed"],
      fee_creator_role: ["staff", "admin"],
      fee_status: ["pending", "paid"],
      pix_key_type: ["cpf", "email", "phone", "random"],
      registration_status: ["pending", "confirmed", "cancelled", "processing"],
      reimbursement_category: [
        "alimentacao",
        "transporte",
        "passagem",
        "gasolina",
        "hospedagem",
        "outro",
      ],
      reimbursement_status: ["pending", "paid"],
      shirt_size: ["P", "M", "G", "GG", "XG"],
    },
  },
} as const
