export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      plans: {
        Row: {
          id: string;
          name: string;
          monthly_price: number;
          user_limit: number;
          token_limit_per_month: number;
          active: boolean;
          mp_plan_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          monthly_price: number;
          user_limit: number;
          token_limit_per_month: number;
          active?: boolean;
          mp_plan_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          monthly_price?: number;
          user_limit?: number;
          token_limit_per_month?: number;
          active?: boolean;
          mp_plan_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          plan_id: string;
          mp_subscription_id: string | null;
          subscription_status: "active" | "past_due" | "cancelled" | "pending";
          billing_cycle: "monthly" | "annual";
          current_period_end: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          plan_id: string;
          mp_subscription_id?: string | null;
          subscription_status?: "active" | "past_due" | "cancelled" | "pending";
          billing_cycle?: "monthly" | "annual";
          current_period_end?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          plan_id?: string;
          mp_subscription_id?: string | null;
          subscription_status?: "active" | "past_due" | "cancelled" | "pending";
          billing_cycle?: "monthly" | "annual";
          current_period_end?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_plan_id_fkey";
            columns: ["plan_id"];
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          full_name: string | null;
          role: "chief_doctor" | "doctor" | "nurse" | "administrative" | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          full_name?: string | null;
          role?: "chief_doctor" | "doctor" | "nurse" | "administrative" | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          full_name?: string | null;
          role?: "chief_doctor" | "doctor" | "nurse" | "administrative" | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: "doctor" | "nurse" | "administrative";
          invited_by: string;
          accepted: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: "doctor" | "nurse" | "administrative";
          invited_by: string;
          accepted?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          role?: "doctor" | "nurse" | "administrative";
          invited_by?: string;
          accepted?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// Convenience helpers — mirrors what `supabase gen types` exports
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
