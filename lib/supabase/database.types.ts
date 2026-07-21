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
      ai_dashboard_summaries: {
        Row: {
          content: Json
          generated_at: string
          generated_by: string | null
          organization_id: string
        }
        Insert: {
          content: Json
          generated_at?: string
          generated_by?: string | null
          organization_id: string
        }
        Update: {
          content?: Json
          generated_at?: string
          generated_by?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_dashboard_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_settings: {
        Row: {
          expiry_days_ahead: number
          expiry_enabled: boolean
          low_stock_enabled: boolean
          organization_id: string
          reorder_enabled: boolean
          updated_at: string
        }
        Insert: {
          expiry_days_ahead?: number
          expiry_enabled?: boolean
          low_stock_enabled?: boolean
          organization_id: string
          reorder_enabled?: boolean
          updated_at?: string
        }
        Update: {
          expiry_days_ahead?: number
          expiry_enabled?: boolean
          low_stock_enabled?: boolean
          organization_id?: string
          reorder_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          expiry_date: string | null
          id: string
          organization_id: string
          product_id: string
          quantity: number | null
          resolved_at: string | null
          status: "active" | "resolved"
          threshold: number | null
          triggered_at: string
          type: "low_stock" | "expiry" | "reorder_suggested"
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          expiry_date?: string | null
          id?: string
          organization_id: string
          product_id: string
          quantity?: number | null
          resolved_at?: string | null
          status?: "active" | "resolved"
          threshold?: number | null
          triggered_at?: string
          type: "low_stock" | "expiry" | "reorder_suggested"
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          expiry_date?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number | null
          resolved_at?: string | null
          status?: "active" | "resolved"
          threshold?: number | null
          triggered_at?: string
          type?: "low_stock" | "expiry" | "reorder_suggested"
        }
        Relationships: [
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ean_lookup: {
        Row: {
          created_at: string
          ean: string
          name: string
        }
        Insert: {
          created_at?: string
          ean: string
          name: string
        }
        Update: {
          created_at?: string
          ean?: string
          name?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted: boolean
          created_at: string
          email: string
          id: string
          invited_by: string
          organization_id: string
          role: "doctor" | "nurse" | "administrative"
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          email: string
          id?: string
          invited_by: string
          organization_id: string
          role: "doctor" | "nurse" | "administrative"
        }
        Update: {
          accepted?: boolean
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: "doctor" | "nurse" | "administrative"
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          billing_cycle: "monthly" | "annual"
          created_at: string
          current_period_end: string | null
          id: string
          mp_subscription_id: string | null
          name: string
          plan_id: string
          subscription_status: "active" | "past_due" | "cancelled" | "pending"
        }
        Insert: {
          active?: boolean
          billing_cycle?: "monthly" | "annual"
          created_at?: string
          current_period_end?: string | null
          id?: string
          mp_subscription_id?: string | null
          name: string
          plan_id: string
          subscription_status?: "active" | "past_due" | "cancelled" | "pending"
        }
        Update: {
          active?: boolean
          billing_cycle?: "monthly" | "annual"
          created_at?: string
          current_period_end?: string | null
          id?: string
          mp_subscription_id?: string | null
          name?: string
          plan_id?: string
          subscription_status?: "active" | "past_due" | "cancelled" | "pending"
        }
        Relationships: [
          {
            foreignKeyName: "organizations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          id: string
          monthly_price: number
          mp_plan_id: string | null
          name: string
          token_limit_per_month: number
          user_limit: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          monthly_price: number
          mp_plan_id?: string | null
          name: string
          token_limit_per_month: number
          user_limit: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          monthly_price?: number
          mp_plan_id?: string | null
          name?: string
          token_limit_per_month?: number
          user_limit?: number
        }
        Relationships: []
      }
      predictive_settings: {
        Row: {
          coverage_days: number
          lead_time_days: number | null
          organization_id: string
          safety_days_desirable: number
          safety_days_essential: number
          safety_days_vital: number
          updated_at: string
        }
        Insert: {
          coverage_days?: number
          lead_time_days?: number | null
          organization_id: string
          safety_days_desirable?: number
          safety_days_essential?: number
          safety_days_vital?: number
          updated_at?: string
        }
        Update: {
          coverage_days?: number
          lead_time_days?: number | null
          organization_id?: string
          safety_days_desirable?: number
          safety_days_essential?: number
          safety_days_vital?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictive_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          criticality: string | null
          description: string | null
          ean: string | null
          id: string
          name: string
          organization_id: string
          presentation: string | null
          unit: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          criticality?: string | null
          description?: string | null
          ean?: string | null
          id?: string
          name: string
          organization_id: string
          presentation?: string | null
          unit?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          criticality?: string | null
          description?: string | null
          ean?: string | null
          id?: string
          name?: string
          organization_id?: string
          presentation?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string | null
          id: string
          organization_id: string | null
          role: "chief_doctor" | "doctor" | "nurse" | "administrative" | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          role?: "chief_doctor" | "doctor" | "nurse" | "administrative" | null
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          role?: "chief_doctor" | "doctor" | "nurse" | "administrative" | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_products: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          product_id: string
          provider_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          product_id: string
          provider_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          product_id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_products_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          active: boolean
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          accepted_quantity: number | null
          expiry_date: string | null
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_price: number | null
        }
        Insert: {
          accepted_quantity?: number | null
          expiry_date?: string | null
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_price?: number | null
        }
        Update: {
          accepted_quantity?: number | null
          expiry_date?: string | null
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          organization_id: string
          provider_id: string | null
          received_at: string | null
          status: "draft" | "confirmed" | "received" | "cancelled"
          supplier: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          organization_id: string
          provider_id?: string | null
          received_at?: string | null
          status?: "draft" | "confirmed" | "received" | "cancelled"
          supplier?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          organization_id?: string
          provider_id?: string | null
          received_at?: string | null
          status?: "draft" | "confirmed" | "received" | "cancelled"
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      receptors: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          patient_type: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          patient_type?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          patient_type?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receptors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          id: string
          min_quantity: number
          organization_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          min_quantity?: number
          organization_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          min_quantity?: number
          organization_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_batches: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          organization_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          organization_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          corrects_movement_id: string | null
          created_at: string
          expiry_date: string | null
          id: string
          notes: string | null
          organization_id: string
          product_id: string
          purchase_id: string | null
          quantity: number
          receptor_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          corrects_movement_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          product_id: string
          purchase_id?: string | null
          quantity: number
          receptor_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          corrects_movement_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          product_id?: string
          purchase_id?: string | null
          quantity?: number
          receptor_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_corrects_movement_id_fkey"
            columns: ["corrects_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_receptor_id_fkey"
            columns: ["receptor_id"]
            isOneToOne: false
            referencedRelation: "receptors"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage: {
        Row: {
          created_at: string
          id: string
          input_tokens: number
          organization_id: string
          output_tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_tokens: number
          organization_id: string
          output_tokens: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_tokens?: number
          organization_id?: string
          output_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      monthly_token_consumption: {
        Row: {
          month: string | null
          organization_id: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _apply_batch_delta: {
        Args: {
          p_delta: number
          p_expiry: string
          p_org: string
          p_product: string
        }
        Returns: undefined
      }
      create_purchase: {
        Args: {
          p_provider_id: string | null
          p_notes: string | null
          p_items: Json
        }
        Returns: string
      }
      current_organization_id: { Args: never; Returns: string }
      current_role: { Args: never; Returns: string }
      receive_purchase: {
        Args: {
          p_purchase_id: string
          p_items: Json
        }
        Returns: undefined
      }
      rectify_stock_movement: {
        Args: {
          p_movement_id: string
          p_new_expiry_date?: string
          p_new_quantity: number
          p_reason?: string
        }
        Returns: undefined
      }
      register_stock_exit: {
        Args: {
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_receptor_id?: string
        }
        Returns: undefined
      }
      register_stock_movement: {
        Args: {
          p_expiry_date?: string
          p_notes?: string
          p_product_id: string
          p_purchase_id?: string
          p_quantity: number
          p_type: string
        }
        Returns: {
          id: string
          min_quantity: number
          organization_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "stock"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sweep_alerts: {
        Args: never
        Returns: undefined
      }
      sync_reorder_alerts: {
        Args: { p_items: Json }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
