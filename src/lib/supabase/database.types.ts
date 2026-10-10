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
      availability: {
        Row: {
          id: string
          kind: string
          notes: string
          ott_on: string | null
          provider: string
          region: string
          release_on: string | null
          source_url: string | null
          theatrical_on: string | null
          title_id: string
          updated_at: string
          user_id: string
          verified_on: string | null
        }
        Insert: {
          id?: string
          kind?: string
          notes?: string
          ott_on?: string | null
          provider: string
          region: string
          release_on?: string | null
          source_url?: string | null
          theatrical_on?: string | null
          title_id: string
          updated_at?: string
          user_id?: string
          verified_on?: string | null
        }
        Update: {
          id?: string
          kind?: string
          notes?: string
          ott_on?: string | null
          provider?: string
          region?: string
          release_on?: string | null
          source_url?: string | null
          theatrical_on?: string | null
          title_id?: string
          updated_at?: string
          user_id?: string
          verified_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_user_id_title_id_fkey"
            columns: ["user_id", "title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          display_name: string
          region: string
          updated_at: string
          user_id: string
        }
        Insert: {
          display_name?: string
          region?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          display_name?: string
          region?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          availability_note: string
          caveat: string
          fit: string
          priority: number
          reason: string
          recommended_on: string
          source: string
          state: string
          title_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_note?: string
          caveat?: string
          fit?: string
          priority?: number
          reason: string
          recommended_on?: string
          source?: string
          state?: string
          title_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          availability_note?: string
          caveat?: string
          fit?: string
          priority?: number
          reason?: string
          recommended_on?: string
          source?: string
          state?: string
          title_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_user_id_title_id_fkey"
            columns: ["user_id", "title_id"]
            isOneToOne: true
            referencedRelation: "titles"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      review_snapshots: {
        Row: {
          audience_score: string | null
          captured_on: string | null
          critic_score: string | null
          id: string
          notes: string
          score: string | null
          score_type: string
          source: string
          source_url: string | null
          title_id: string
          updated_at: string
          user_id: string
          verified: boolean
          vote_count: number | null
        }
        Insert: {
          audience_score?: string | null
          captured_on?: string | null
          critic_score?: string | null
          id?: string
          notes?: string
          score?: string | null
          score_type?: string
          source: string
          source_url?: string | null
          title_id: string
          updated_at?: string
          user_id?: string
          verified?: boolean
          vote_count?: number | null
        }
        Update: {
          audience_score?: string | null
          captured_on?: string | null
          critic_score?: string | null
          id?: string
          notes?: string
          score?: string | null
          score_type?: string
          source?: string
          source_url?: string | null
          title_id?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
          vote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "review_snapshots_user_id_title_id_fkey"
            columns: ["user_id", "title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      seasons: {
        Row: {
          completed_on: string | null
          notes: string
          number: number
          rank: number | null
          rating: number | null
          status: string
          title_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_on?: string | null
          notes?: string
          number: number
          rank?: number | null
          rating?: number | null
          status?: string
          title_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_on?: string | null
          notes?: string
          number?: number
          rank?: number | null
          rating?: number | null
          status?: string
          title_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_user_id_title_id_fkey"
            columns: ["user_id", "title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      taste_signals: {
        Row: {
          notes: string
          signal: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          notes?: string
          signal: string
          updated_at?: string
          user_id?: string
          weight: number
        }
        Update: {
          notes?: string
          signal?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      titles: {
        Row: {
          country: string
          created_at: string
          id: string
          imdb_id: string | null
          media_type: string
          original_title: string | null
          poster_url: string | null
          provider_ids: Json
          release_year: number | null
          synopsis: string
          tags: string[]
          title: string
          tmdb_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          imdb_id?: string | null
          media_type: string
          original_title?: string | null
          poster_url?: string | null
          provider_ids?: Json
          release_year?: number | null
          synopsis?: string
          tags?: string[]
          title: string
          tmdb_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          imdb_id?: string | null
          media_type?: string
          original_title?: string | null
          poster_url?: string | null
          provider_ids?: Json
          release_year?: number | null
          synopsis?: string
          tags?: string[]
          title?: string
          tmdb_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_entries: {
        Row: {
          completed_on: string | null
          favorite: boolean
          notes: string
          priority: number
          rating: number | null
          started_on: string | null
          status: string
          title_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_on?: string | null
          favorite?: boolean
          notes?: string
          priority?: number
          rating?: number | null
          started_on?: string | null
          status?: string
          title_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_on?: string | null
          favorite?: boolean
          notes?: string
          priority?: number
          rating?: number | null
          started_on?: string | null
          status?: string
          title_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_entries_user_id_title_id_fkey"
            columns: ["user_id", "title_id"]
            isOneToOne: true
            referencedRelation: "titles"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      export_library: { Args: never; Returns: Json }
      import_library: { Args: { payload: Json }; Returns: Json }
      library_page: { Args: { filters?: Json }; Returns: Json }
      title_document: {
        Args: { t: Database["public"]["Tables"]["titles"]["Row"] }
        Returns: Json
      }
      upcoming_releases: {
        Args: { p_region?: string; p_today?: string }
        Returns: {
          event_date: string
          event_type: string
          provider: string
          region: string
          source_url: string
          title: string
          title_id: string
        }[]
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
