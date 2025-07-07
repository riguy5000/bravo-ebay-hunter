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
      ebay_aspects: {
        Row: {
          aspect_name: string
          brand: string | null
          category_id: string
          created_at: string
          id: string
          refreshed_at: string
          values_json: Json
        }
        Insert: {
          aspect_name: string
          brand?: string | null
          category_id: string
          created_at?: string
          id?: string
          refreshed_at?: string
          values_json: Json
        }
        Update: {
          aspect_name?: string
          brand?: string | null
          category_id?: string
          created_at?: string
          id?: string
          refreshed_at?: string
          values_json?: Json
        }
        Relationships: []
      }
      matches_gemstone: {
        Row: {
          ai_reasoning: string | null
          ai_score: number | null
          arrived_toggle: boolean | null
          buy_format: string | null
          carat: number | null
          cert_lab: string | null
          clarity: string | null
          colour: string | null
          created_at: string
          currency: string | null
          cut_grade: string | null
          ebay_listing_id: string
          ebay_title: string
          ebay_url: string | null
          found_at: string
          id: string
          listed_price: number
          offer1: number | null
          offer2: number | null
          offer3: number | null
          offer4: number | null
          offer5: number | null
          price_diff_percent: number | null
          purchased_toggle: boolean | null
          rapaport_list: number | null
          rapnet_avg: number | null
          refunded_toggle: boolean | null
          return_toggle: boolean | null
          seller_feedback: number | null
          shape: string | null
          shipped_back_toggle: boolean | null
          status: Database["public"]["Enums"]["match_status"]
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          ai_score?: number | null
          arrived_toggle?: boolean | null
          buy_format?: string | null
          carat?: number | null
          cert_lab?: string | null
          clarity?: string | null
          colour?: string | null
          created_at?: string
          currency?: string | null
          cut_grade?: string | null
          ebay_listing_id: string
          ebay_title: string
          ebay_url?: string | null
          found_at?: string
          id?: string
          listed_price: number
          offer1?: number | null
          offer2?: number | null
          offer3?: number | null
          offer4?: number | null
          offer5?: number | null
          price_diff_percent?: number | null
          purchased_toggle?: boolean | null
          rapaport_list?: number | null
          rapnet_avg?: number | null
          refunded_toggle?: boolean | null
          return_toggle?: boolean | null
          seller_feedback?: number | null
          shape?: string | null
          shipped_back_toggle?: boolean | null
          status?: Database["public"]["Enums"]["match_status"]
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          ai_score?: number | null
          arrived_toggle?: boolean | null
          buy_format?: string | null
          carat?: number | null
          cert_lab?: string | null
          clarity?: string | null
          colour?: string | null
          created_at?: string
          currency?: string | null
          cut_grade?: string | null
          ebay_listing_id?: string
          ebay_title?: string
          ebay_url?: string | null
          found_at?: string
          id?: string
          listed_price?: number
          offer1?: number | null
          offer2?: number | null
          offer3?: number | null
          offer4?: number | null
          offer5?: number | null
          price_diff_percent?: number | null
          purchased_toggle?: boolean | null
          rapaport_list?: number | null
          rapnet_avg?: number | null
          refunded_toggle?: boolean | null
          return_toggle?: boolean | null
          seller_feedback?: number | null
          shape?: string | null
          shipped_back_toggle?: boolean | null
          status?: Database["public"]["Enums"]["match_status"]
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_gemstone_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      matches_jewelry: {
        Row: {
          ai_reasoning: string | null
          ai_score: number | null
          arrived_toggle: boolean | null
          buy_format: string | null
          created_at: string
          currency: string | null
          ebay_listing_id: string
          ebay_title: string
          ebay_url: string | null
          found_at: string
          id: string
          karat: number | null
          listed_price: number
          melt_value: number | null
          metal_type: string | null
          offer1: number | null
          offer2: number | null
          offer3: number | null
          offer4: number | null
          offer5: number | null
          profit_scrap: number | null
          purchased_toggle: boolean | null
          refiner_fee_pct: number | null
          refunded_toggle: boolean | null
          return_toggle: boolean | null
          seller_feedback: number | null
          shipped_back_toggle: boolean | null
          spot_price_oz: number | null
          status: Database["public"]["Enums"]["match_status"]
          task_id: string
          updated_at: string
          user_id: string
          weight_g: number | null
        }
        Insert: {
          ai_reasoning?: string | null
          ai_score?: number | null
          arrived_toggle?: boolean | null
          buy_format?: string | null
          created_at?: string
          currency?: string | null
          ebay_listing_id: string
          ebay_title: string
          ebay_url?: string | null
          found_at?: string
          id?: string
          karat?: number | null
          listed_price: number
          melt_value?: number | null
          metal_type?: string | null
          offer1?: number | null
          offer2?: number | null
          offer3?: number | null
          offer4?: number | null
          offer5?: number | null
          profit_scrap?: number | null
          purchased_toggle?: boolean | null
          refiner_fee_pct?: number | null
          refunded_toggle?: boolean | null
          return_toggle?: boolean | null
          seller_feedback?: number | null
          shipped_back_toggle?: boolean | null
          spot_price_oz?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          task_id: string
          updated_at?: string
          user_id: string
          weight_g?: number | null
        }
        Update: {
          ai_reasoning?: string | null
          ai_score?: number | null
          arrived_toggle?: boolean | null
          buy_format?: string | null
          created_at?: string
          currency?: string | null
          ebay_listing_id?: string
          ebay_title?: string
          ebay_url?: string | null
          found_at?: string
          id?: string
          karat?: number | null
          listed_price?: number
          melt_value?: number | null
          metal_type?: string | null
          offer1?: number | null
          offer2?: number | null
          offer3?: number | null
          offer4?: number | null
          offer5?: number | null
          profit_scrap?: number | null
          purchased_toggle?: boolean | null
          refiner_fee_pct?: number | null
          refunded_toggle?: boolean | null
          return_toggle?: boolean | null
          seller_feedback?: number | null
          shipped_back_toggle?: boolean | null
          spot_price_oz?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          task_id?: string
          updated_at?: string
          user_id?: string
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_jewelry_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      matches_watch: {
        Row: {
          ai_reasoning: string | null
          ai_score: number | null
          arrived_toggle: boolean | null
          band_material: string | null
          buy_format: string | null
          case_material: string | null
          case_size_mm: number | null
          chrono24_avg: number | null
          chrono24_low: number | null
          created_at: string
          currency: string | null
          dial_colour: string | null
          ebay_listing_id: string
          ebay_title: string
          ebay_url: string | null
          found_at: string
          id: string
          listed_price: number
          movement: string | null
          offer1: number | null
          offer2: number | null
          offer3: number | null
          offer4: number | null
          offer5: number | null
          price_diff_percent: number | null
          purchased_toggle: boolean | null
          refunded_toggle: boolean | null
          return_toggle: boolean | null
          seller_feedback: number | null
          shipped_back_toggle: boolean | null
          status: Database["public"]["Enums"]["match_status"]
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          ai_score?: number | null
          arrived_toggle?: boolean | null
          band_material?: string | null
          buy_format?: string | null
          case_material?: string | null
          case_size_mm?: number | null
          chrono24_avg?: number | null
          chrono24_low?: number | null
          created_at?: string
          currency?: string | null
          dial_colour?: string | null
          ebay_listing_id: string
          ebay_title: string
          ebay_url?: string | null
          found_at?: string
          id?: string
          listed_price: number
          movement?: string | null
          offer1?: number | null
          offer2?: number | null
          offer3?: number | null
          offer4?: number | null
          offer5?: number | null
          price_diff_percent?: number | null
          purchased_toggle?: boolean | null
          refunded_toggle?: boolean | null
          return_toggle?: boolean | null
          seller_feedback?: number | null
          shipped_back_toggle?: boolean | null
          status?: Database["public"]["Enums"]["match_status"]
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          ai_score?: number | null
          arrived_toggle?: boolean | null
          band_material?: string | null
          buy_format?: string | null
          case_material?: string | null
          case_size_mm?: number | null
          chrono24_avg?: number | null
          chrono24_low?: number | null
          created_at?: string
          currency?: string | null
          dial_colour?: string | null
          ebay_listing_id?: string
          ebay_title?: string
          ebay_url?: string | null
          found_at?: string
          id?: string
          listed_price?: number
          movement?: string | null
          offer1?: number | null
          offer2?: number | null
          offer3?: number | null
          offer4?: number | null
          offer5?: number | null
          price_diff_percent?: number | null
          purchased_toggle?: boolean | null
          refunded_toggle?: boolean | null
          return_toggle?: boolean | null
          seller_feedback?: number | null
          shipped_back_toggle?: boolean | null
          status?: Database["public"]["Enums"]["match_status"]
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_watch_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      metal_prices: {
        Row: {
          change_amount: number | null
          change_percent: number | null
          created_at: string
          currency: string
          high: number | null
          id: string
          low: number | null
          metal: string
          price: number
          price_gram_10k: number | null
          price_gram_14k: number | null
          price_gram_18k: number | null
          price_gram_24k: number | null
          source: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          change_amount?: number | null
          change_percent?: number | null
          created_at?: string
          currency?: string
          high?: number | null
          id?: string
          low?: number | null
          metal: string
          price: number
          price_gram_10k?: number | null
          price_gram_14k?: number | null
          price_gram_18k?: number | null
          price_gram_24k?: number | null
          source?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          change_amount?: number | null
          change_percent?: number | null
          created_at?: string
          currency?: string
          high?: number | null
          id?: string
          low?: number | null
          metal?: string
          price?: number
          price_gram_10k?: number | null
          price_gram_14k?: number | null
          price_gram_18k?: number | null
          price_gram_24k?: number | null
          source?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
      settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value_json: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value_json: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value_json?: Json
        }
        Relationships: []
      }
      tasks: {
        Row: {
          auction_alert: boolean | null
          created_at: string
          cron_job_id: number | null
          date_from: string | null
          date_to: string | null
          exclude_keywords: string[] | null
          gemstone_filters: Json | null
          id: string
          item_location: string | null
          item_type: Database["public"]["Enums"]["item_type"]
          jewelry_filters: Json | null
          last_run: string | null
          listing_format: string[] | null
          max_price: number | null
          min_price: number | null
          min_seller_feedback: number | null
          name: string
          poll_interval: number | null
          price_delta_type: string | null
          price_delta_value: number | null
          price_percentage: number | null
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
          user_id: string
          watch_filters: Json | null
        }
        Insert: {
          auction_alert?: boolean | null
          created_at?: string
          cron_job_id?: number | null
          date_from?: string | null
          date_to?: string | null
          exclude_keywords?: string[] | null
          gemstone_filters?: Json | null
          id?: string
          item_location?: string | null
          item_type: Database["public"]["Enums"]["item_type"]
          jewelry_filters?: Json | null
          last_run?: string | null
          listing_format?: string[] | null
          max_price?: number | null
          min_price?: number | null
          min_seller_feedback?: number | null
          name: string
          poll_interval?: number | null
          price_delta_type?: string | null
          price_delta_value?: number | null
          price_percentage?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          user_id: string
          watch_filters?: Json | null
        }
        Update: {
          auction_alert?: boolean | null
          created_at?: string
          cron_job_id?: number | null
          date_from?: string | null
          date_to?: string | null
          exclude_keywords?: string[] | null
          gemstone_filters?: Json | null
          id?: string
          item_location?: string | null
          item_type?: Database["public"]["Enums"]["item_type"]
          jewelry_filters?: Json | null
          last_run?: string | null
          listing_format?: string[] | null
          max_price?: number | null
          min_price?: number | null
          min_seller_feedback?: number | null
          name?: string
          poll_interval?: number | null
          price_delta_type?: string | null
          price_delta_value?: number | null
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
      schedule_task_cron: {
        Args: { task_id_param: string; poll_interval_param: number }
        Returns: number
      }
      unschedule_task_cron: {
        Args: { task_id_param: string }
        Returns: undefined
      }
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
