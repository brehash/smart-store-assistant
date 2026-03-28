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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
          view_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
          view_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
          view_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_view_id_fkey"
            columns: ["view_id"]
            isOneToOne: false
            referencedRelation: "views"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_refill_at: string
          monthly_allowance: number
          plan_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_refill_at?: string
          monthly_allowance?: number
          plan_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_refill_at?: string
          monthly_allowance?: number
          plan_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_balances_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_topup_packs: {
        Row: {
          created_at: string
          credits: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          message_id: string | null
          metadata: Json | null
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          memory_type: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding: string
          id?: string
          memory_type?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          memory_type?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      message_limits: {
        Row: {
          created_at: string | null
          daily_limit: number | null
          id: string
          monthly_limit: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_limit?: number | null
          id?: string
          monthly_limit?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_limit?: number | null
          id?: string
          monthly_limit?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          rich_content: Json | null
          role: string
          token_usage: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          rich_content?: Json | null
          role: string
          token_usage?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          rich_content?: Json | null
          role?: string
          token_usage?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean
          monthly_price_cents: number
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_price_cents?: number
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_price_cents?: number
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          key: string
          preference_type: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          preference_type: string
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          preference_type?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      views: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read: boolean
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      woo_cache: {
        Row: {
          cache_key: string
          data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cache_key: string
          data?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cache_key?: string
          data?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      woo_connections: {
        Row: {
          active_plugins: string[]
          consumer_key: string
          consumer_secret: string
          created_at: string
          id: string
          is_active: boolean
          order_statuses: string[]
          response_language: string
          store_name: string | null
          store_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_plugins?: string[]
          consumer_key: string
          consumer_secret: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_statuses?: string[]
          response_language?: string
          store_name?: string | null
          store_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_plugins?: string[]
          consumer_key?: string
          consumer_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_statuses?: string[]
          response_language?: string
          store_name?: string | null
          store_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      woo_integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          integration_key: string
          is_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          integration_key: string
          is_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          integration_key?: string
          is_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_memories: {
        Args: {
          _embedding: string
          _match_count?: number
          _match_threshold?: number
          _user_id: string
        }
        Returns: {
          content: string
          id: string
          memory_type: string
          metadata: Json
          similarity: number
        }[]
      }
      refill_credits_if_due: {
        Args: { _user_id: string }
        Returns: {
          balance: number
          created_at: string
          id: string
          last_refill_at: string
          monthly_allowance: number
          plan_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "credit_balances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
