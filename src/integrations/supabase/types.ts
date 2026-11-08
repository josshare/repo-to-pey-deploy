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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          id: string
          label: string
          last4: string
          merchant_id: string
          provider_account_id: string
          status: string
        }
        Insert: {
          id?: string
          label: string
          last4: string
          merchant_id: string
          provider_account_id: string
          status?: string
        }
        Update: {
          id?: string
          label?: string
          last4?: string
          merchant_id?: string
          provider_account_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          amount_cents: number
          concept: string
          created_at: string
          id: string
          kind: string
          merchant_id: string
          status: string
          token: string
          total_cents: number
        }
        Insert: {
          amount_cents: number
          concept: string
          created_at?: string
          id?: string
          kind: string
          merchant_id: string
          status?: string
          token: string
          total_cents: number
        }
        Update: {
          amount_cents?: number
          concept?: string
          created_at?: string
          id?: string
          kind?: string
          merchant_id?: string
          status?: string
          token?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "charges_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          actor: string
          draft: Json
          id: string
          run_id: string
          step: string
        }
        Insert: {
          actor: string
          draft?: Json
          id?: string
          run_id: string
          step?: string
        }
        Update: {
          actor?: string
          draft?: Json
          id?: string
          run_id?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "demo_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_runs: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: []
      }
      merchants: {
        Row: {
          created_at: string
          id: string
          name: string
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchants_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "demo_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          actions: Json
          actor: string
          body: string
          created_at: string
          direction: string
          id: string
          run_id: string
          source_id: string
        }
        Insert: {
          actions?: Json
          actor: string
          body: string
          created_at?: string
          direction: string
          id?: string
          run_id: string
          source_id: string
        }
        Update: {
          actions?: Json
          actor?: string
          body?: string
          created_at?: string
          direction?: string
          id?: string
          run_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "demo_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sessions: {
        Row: {
          expires_at: string
          id: string
          run_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          expires_at: string
          id?: string
          run_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          expires_at?: string
          id?: string
          run_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sessions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "demo_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          account_id: string
          amount_cents: number
          charge_id: string
          created_at: string
          expires_at: string
          id: string
          provider_transaction_id: string
          status: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          charge_id: string
          created_at?: string
          expires_at: string
          id?: string
          provider_transaction_id: string
          status?: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          charge_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          provider_transaction_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          attempt_id: string
          id: string
          provider_transaction_id: string
          received_at: string
        }
        Insert: {
          amount_cents: number
          attempt_id: string
          id?: string
          provider_transaction_id: string
          received_at?: string
        }
        Update: {
          amount_cents?: number
          attempt_id?: string
          id?: string
          provider_transaction_id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          external_id: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          provider: string
          run_id: string
          status: string
          type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          external_id: string
          id?: string
          last_error?: string | null
          payload: Json
          processed_at?: string | null
          provider: string
          run_id: string
          status?: string
          type: string
        }
        Update: {
          attempts?: number
          created_at?: string
          external_id?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          run_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "demo_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
