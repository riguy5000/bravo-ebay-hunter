export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      matches: {
        Row: {
          ai_reasoning: string | null
          ai_score: number | null
          created_at: string
          ebay_item_id: string
          end_time: string | null
          id: string
          image_url: string | null
          listing_url: string | null
          notes: string | null
          offer_amount: number | null
          price: number
          seller_feedback: number | null
          seller_name: string | null
          status: Database["public"]["Enums"]["match_status"]
          task_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          ai_score?: number | null
          created_at?: string
          ebay_item_id: string
          end_time?: string | null
          id?: string
          image_url?: string | null
          listing_url?: string | null
          notes?: string | null
          offer_amount?: number | null
          price: number
          seller_feedback?: number | null
          seller_name?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          task_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          ai_score?: number | null
          created_at?: string
          ebay_item_id?: string
          end_time?: string | null
          id?: string
          image_url?: string | null
          listing_url?: string | null
          notes?: string | null
          offer_amount?: number | null
          price?: number
          seller_feedback?: number | null
          seller_name?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          task_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          fees: number | null
          id: string
          match_id: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number
          shipping_cost: number | null
          status: Database["public"]["Enums"]["purchase_status"]
          total_cost: number
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fees?: number | null
          id?: string
          match_id: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price: number
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["purchase_status"]
          total_cost: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fees?: number | null
          id?: string
          match_id?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["purchase_status"]
          total_cost?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      resales: {
        Row: {
          created_at: string
          id: string
          listed_date: string | null
          listing_price: number
          listing_title: string | null
          notes: string | null
          platform: string
          profit: number | null
          purchase_id: string
          roi_percentage: number | null
          sale_price: number | null
          sold_date: string | null
          status: Database["public"]["Enums"]["resale_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listed_date?: string | null
          listing_price: number
          listing_title?: string | null
          notes?: string | null
          platform: string
          profit?: number | null
          purchase_id: string
          roi_percentage?: number | null
          sale_price?: number | null
          sold_date?: string | null
          status?: Database["public"]["Enums"]["resale_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listed_date?: string | null
          listing_price?: number
          listing_title?: string | null
          notes?: string | null
          platform?: string
          profit?: number | null
          purchase_id?: string
          roi_percentage?: number | null
          sale_price?: number | null
          sold_date?: string | null
          status?: Database["public"]["Enums"]["resale_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resales_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          completed_date: string | null
          created_at: string
          id: string
          initiated_date: string | null
          notes: string | null
          purchase_id: string
          reason: string
          refund_amount: number | null
          return_cost: number | null
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          id?: string
          initiated_date?: string | null
          notes?: string | null
          purchase_id: string
          reason: string
          refund_amount?: number | null
          return_cost?: number | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          id?: string
          initiated_date?: string | null
          notes?: string | null
          purchase_id?: string
          reason?: string
          refund_amount?: number | null
          return_cost?: number | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          gemstone_filters: Json | null
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          jewelry_filters: Json | null
          listing_format: string[] | null
          max_price: number | null
          min_seller_feedback: number | null
          name: string
          poll_interval: number | null
          price_percentage: number | null
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
          user_id: string
          watch_filters: Json | null
        }
        Insert: {
          created_at?: string
          gemstone_filters?: Json | null
          id?: string
          item_type: Database["public"]["Enums"]["item_type"]
          jewelry_filters?: Json | null
          listing_format?: string[] | null
          max_price?: number | null
          min_seller_feedback?: number | null
          name: string
          poll_interval?: number | null
          price_percentage?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          user_id: string
          watch_filters?: Json | null
        }
        Update: {
          created_at?: string
          gemstone_filters?: Json | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          jewelry_filters?: Json | null
          listing_format?: string[] | null
          max_price?: number | null
          min_seller_feedback?: number | null
          name?: string
          poll_interval?: number | null
          price_percentage?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          user_id?: string
          watch_filters?: Json | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          default_max_price: number | null
          default_poll_interval: number | null
          ebay_api_version: string | null
          email_notifications: boolean | null
          gold_api_version: string | null
          id: string
          match_notifications: boolean | null
          openai_model: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_max_price?: number | null
          default_poll_interval?: number | null
          ebay_api_version?: string | null
          email_notifications?: boolean | null
          gold_api_version?: string | null
          id?: string
          match_notifications?: boolean | null
          openai_model?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_max_price?: number | null
          default_poll_interval?: number | null
          ebay_api_version?: string | null
          email_notifications?: boolean | null
          gold_api_version?: string | null
          id?: string
          match_notifications?: boolean | null
          openai_model?: string | null
          theme?: string | null
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
      [_ in never]: never
    }
    Enums: {
      item_type: "watch" | "jewelry" | "gemstone"
      match_status: "new" | "reviewed" | "offered" | "purchased" | "passed"
      purchase_status: "pending" | "completed" | "cancelled" | "returned"
      resale_status: "pending" | "listed" | "sold" | "cancelled"
      return_status:
        | "initiated"
        | "shipped"
        | "received"
        | "refunded"
        | "denied"
      task_status: "active" | "paused" | "stopped"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      item_type: ["watch", "jewelry", "gemstone"],
      match_status: ["new", "reviewed", "offered", "purchased", "passed"],
      purchase_status: ["pending", "completed", "cancelled", "returned"],
      resale_status: ["pending", "listed", "sold", "cancelled"],
      return_status: ["initiated", "shipped", "received", "refunded", "denied"],
      task_status: ["active", "paused", "stopped"],
    },
  },
} as const
