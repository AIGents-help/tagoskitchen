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
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_resources: {
        Row: {
          booking_id: string
          group_id: string | null
          hourly_rate_cents: number
          id: string
          resource_id: string | null
        }
        Insert: {
          booking_id: string
          group_id?: string | null
          hourly_rate_cents: number
          id?: string
          resource_id?: string | null
        }
        Update: {
          booking_id?: string
          group_id?: string | null
          hourly_rate_cents?: number
          id?: string
          resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_resources_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_resources_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "equipment_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "equipment_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          host_payout_cents: number
          id: string
          kitchen_id: string
          notes: string | null
          platform_fee_cents: number
          renter_business_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id: string | null
          subtotal_cents: number
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          host_payout_cents: number
          id?: string
          kitchen_id: string
          notes?: string | null
          platform_fee_cents: number
          renter_business_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
          subtotal_cents: number
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          host_payout_cents?: number
          id?: string
          kitchen_id?: string
          notes?: string | null
          platform_fee_cents?: number
          renter_business_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_renter_business_id_fkey"
            columns: ["renter_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_type: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          payouts_enabled: boolean
          slug: string
          stripe_account_id: string | null
        }
        Insert: {
          business_type?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          payouts_enabled?: boolean
          slug: string
          stripe_account_id?: string | null
        }
        Update: {
          business_type?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          payouts_enabled?: boolean
          slug?: string
          stripe_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payments: {
        Row: {
          amount_cents: number
          business_id: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          id: string
          platform_fee_cents: number
          purpose: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_payment_link_id: string | null
        }
        Insert: {
          amount_cents: number
          business_id: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          platform_fee_cents?: number
          purpose: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
        }
        Update: {
          amount_cents?: number
          business_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          platform_fee_cents?: number
          purpose?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          business_id: string
          created_at: string
          credential_number: string | null
          credential_type: string
          document_path: string
          expires_on: string | null
          id: string
          issued_on: string | null
          issuing_authority: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: Database["public"]["Enums"]["credential_status"]
        }
        Insert: {
          business_id: string
          created_at?: string
          credential_number?: string | null
          credential_type: string
          document_path: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuing_authority?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["credential_status"]
        }
        Update: {
          business_id?: string
          created_at?: string
          credential_number?: string | null
          credential_type?: string
          document_path?: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuing_authority?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["credential_status"]
        }
        Relationships: [
          {
            foreignKeyName: "credentials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_group_members: {
        Row: {
          group_id: string
          resource_id: string
        }
        Insert: {
          group_id: string
          resource_id: string
        }
        Update: {
          group_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "equipment_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_group_members_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "equipment_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_groups: {
        Row: {
          active: boolean
          capacity: number
          description: string | null
          hourly_rate_cents: number
          id: string
          kitchen_id: string
          name: string
        }
        Insert: {
          active?: boolean
          capacity?: number
          description?: string | null
          hourly_rate_cents: number
          id?: string
          kitchen_id: string
          name: string
        }
        Update: {
          active?: boolean
          capacity?: number
          description?: string | null
          hourly_rate_cents?: number
          id?: string
          kitchen_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_groups_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_resources: {
        Row: {
          active: boolean
          capacity: number
          category: string
          hourly_rate_cents: number
          id: string
          kitchen_id: string
          name: string
        }
        Insert: {
          active?: boolean
          capacity?: number
          category: string
          hourly_rate_cents: number
          id?: string
          kitchen_id: string
          name: string
        }
        Update: {
          active?: boolean
          capacity?: number
          category?: string
          hourly_rate_cents?: number
          id?: string
          kitchen_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_resources_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchens: {
        Row: {
          active: boolean
          address_line1: string
          city: string
          created_at: string
          description: string | null
          id: string
          license_status: string
          name: string
          owner_business_id: string
          postal_code: string
          region: string
          slug: string
          timezone: string
        }
        Insert: {
          active?: boolean
          address_line1: string
          city: string
          created_at?: string
          description?: string | null
          id?: string
          license_status?: string
          name: string
          owner_business_id: string
          postal_code: string
          region: string
          slug: string
          timezone?: string
        }
        Update: {
          active?: boolean
          address_line1?: string
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          license_status?: string
          name?: string
          owner_business_id?: string
          postal_code?: string
          region?: string
          slug?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchens_owner_business_id_fkey"
            columns: ["owner_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_business_member: { Args: { target: string }; Returns: boolean }
    }
    Enums: {
      booking_status:
        | "draft"
        | "pending_documents"
        | "pending_payment"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "refunded"
      credential_status: "pending" | "approved" | "rejected" | "expired"
      member_role: "owner" | "manager" | "staff"
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
    Enums: {
      booking_status: [
        "draft",
        "pending_documents",
        "pending_payment",
        "confirmed",
        "completed",
        "cancelled",
        "refunded",
      ],
      credential_status: ["pending", "approved", "rejected", "expired"],
      member_role: ["owner", "manager", "staff"],
    },
  },
} as const
