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
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
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
      purchase_items: {
        Row: {
          expiry_date: string | null
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_price: number | null
        }
        Insert: {
          expiry_date?: string | null
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_price?: number | null
        }
        Update: {
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
          received_at: string | null
          status: string
          supplier: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          organization_id: string
          received_at?: string | null
          status?: string
          supplier?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          organization_id?: string
          received_at?: string | null
          status?: string
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
          quantity: number
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
          quantity: number
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
          quantity?: number
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
        ]
      }
      supplies: {
        Row: {
          created_at: string
          expire_date: string | null
          id: number
          name: string | null
        }
        Insert: {
          created_at?: string
          expire_date?: string | null
          id?: number
          name?: string | null
        }
        Update: {
          created_at?: string
          expire_date?: string | null
          id?: number
          name?: string | null
        }
        Relationships: []
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
      current_organization_id: { Args: never; Returns: string }
      current_role: { Args: never; Returns: string }
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
        Args: { p_notes?: string; p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      register_stock_movement: {
        Args: {
          p_expiry_date?: string
          p_notes?: string
          p_product_id: string
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
