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
      categories: {
        Row: {
          active: boolean
          championship_id: string
          created_at: string
          description: string | null
          id: string
          max_slots: number
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          championship_id: string
          created_at?: string
          description?: string | null
          id?: string
          max_slots: number
          name: string
          price_cents?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          championship_id?: string
          created_at?: string
          description?: string | null
          id?: string
          max_slots?: number
          name?: string
          price_cents?: number
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
      championships: {
        Row: {
          active: boolean
          cancellation_policy: string | null
          cover_image_url: string | null
          created_at: string
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
          updated_at: string
        }
        Insert: {
          active?: boolean
          cancellation_policy?: string | null
          cover_image_url?: string | null
          created_at?: string
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
          updated_at?: string
        }
        Update: {
          active?: boolean
          cancellation_policy?: string | null
          cover_image_url?: string | null
          created_at?: string
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
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          amount_cents: number | null
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          athlete1_name: string
          athlete1_phone: string
          athlete1_shirt_size: Database["public"]["Enums"]["shirt_size"]
          athlete2_name: string
          athlete2_phone: string
          athlete2_shirt_size: Database["public"]["Enums"]["shirt_size"]
          category_id: string
          contact_email: string
          created_at: string
          id: string
          payment_id: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          voucher_code: string
        }
        Insert: {
          amount_cents?: number | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          athlete1_name: string
          athlete1_phone: string
          athlete1_shirt_size: Database["public"]["Enums"]["shirt_size"]
          athlete2_name: string
          athlete2_phone: string
          athlete2_shirt_size: Database["public"]["Enums"]["shirt_size"]
          category_id: string
          contact_email: string
          created_at?: string
          id?: string
          payment_id?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          voucher_code: string
        }
        Update: {
          amount_cents?: number | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          athlete1_name?: string
          athlete1_phone?: string
          athlete1_shirt_size?: Database["public"]["Enums"]["shirt_size"]
          athlete2_name?: string
          athlete2_phone?: string
          athlete2_shirt_size?: Database["public"]["Enums"]["shirt_size"]
          category_id?: string
          contact_email?: string
          created_at?: string
          id?: string
          payment_id?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
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
      cancel_registration: { Args: { _id: string }; Returns: undefined }
      confirm_registration: { Args: { _id: string }; Returns: undefined }
      confirm_registration_by_payment: {
        Args: { _payment_id: string; _registration_id: string }
        Returns: undefined
      }
      create_registration: { Args: { payload: Json }; Returns: Json }
      generate_voucher_code: { Args: never; Returns: string }
      get_category_availability: {
        Args: { _category_id: string }
        Returns: number
      }
      get_registration_by_voucher: { Args: { _code: string }; Returns: Json }
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
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      promote_user_to_admin: { Args: { _email: string }; Returns: Json }
      revoke_admin: { Args: { _user_id: string }; Returns: undefined }
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
    }
    Enums: {
      app_role: "admin" | "master"
      registration_status: "pending" | "confirmed" | "cancelled"
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
      registration_status: ["pending", "confirmed", "cancelled"],
      shirt_size: ["P", "M", "G", "GG", "XG"],
    },
  },
} as const
