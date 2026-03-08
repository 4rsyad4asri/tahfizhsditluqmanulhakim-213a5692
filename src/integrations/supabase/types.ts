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
      class_penguji: {
        Row: {
          class_id: string
          created_at: string
          id: string
          penguji_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          penguji_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          penguji_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_penguji_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_penguji_penguji_id_fkey"
            columns: ["penguji_id"]
            isOneToOne: false
            referencedRelation: "penguji"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          grade: number
          id: string
          name: string
          section: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade: number
          id?: string
          name: string
          section: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          name?: string
          section?: string
          updated_at?: string
        }
        Relationships: []
      }
      penguji: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      setoran: {
        Row: {
          ayat_akhir: number
          ayat_mulai: number
          catatan_guru: string | null
          created_at: string
          id: string
          juz: number
          kelancaran: number
          kesalahan_mad: number
          kesalahan_makhraj: number
          kesalahan_tajwid: number
          lupa_ayat: number
          nilai: number
          student_id: string
          surah: string
          tanggal: string
          terhenti_terbata: number
        }
        Insert: {
          ayat_akhir: number
          ayat_mulai: number
          catatan_guru?: string | null
          created_at?: string
          id?: string
          juz: number
          kelancaran?: number
          kesalahan_mad?: number
          kesalahan_makhraj?: number
          kesalahan_tajwid?: number
          lupa_ayat?: number
          nilai?: number
          student_id: string
          surah: string
          tanggal?: string
          terhenti_terbata?: number
        }
        Update: {
          ayat_akhir?: number
          ayat_mulai?: number
          catatan_guru?: string | null
          created_at?: string
          id?: string
          juz?: number
          kelancaran?: number
          kesalahan_mad?: number
          kesalahan_makhraj?: number
          kesalahan_tajwid?: number
          lupa_ayat?: number
          nilai?: number
          student_id?: string
          surah?: string
          tanggal?: string
          terhenti_terbata?: number
        }
        Relationships: [
          {
            foreignKeyName: "setoran_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          catatan_penguji: string | null
          class_id: string
          created_at: string
          id: string
          level: Database["public"]["Enums"]["student_level"]
          name: string
          progress_hafalan: number
          status_sertifikasi: Database["public"]["Enums"]["certification_status"]
          target_juz: number
          updated_at: string
        }
        Insert: {
          catatan_penguji?: string | null
          class_id: string
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["student_level"]
          name: string
          progress_hafalan?: number
          status_sertifikasi?: Database["public"]["Enums"]["certification_status"]
          target_juz?: number
          updated_at?: string
        }
        Update: {
          catatan_penguji?: string | null
          class_id?: string
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["student_level"]
          name?: string
          progress_hafalan?: number
          status_sertifikasi?: Database["public"]["Enums"]["certification_status"]
          target_juz?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      ujian: {
        Row: {
          created_at: string
          grade: string
          id: string
          mode: Database["public"]["Enums"]["exam_mode"]
          nilai_akhir: number
          nilai_aspek: Json
          status: Database["public"]["Enums"]["exam_status"]
          student_id: string
          tanggal: string
        }
        Insert: {
          created_at?: string
          grade?: string
          id?: string
          mode: Database["public"]["Enums"]["exam_mode"]
          nilai_akhir?: number
          nilai_aspek?: Json
          status?: Database["public"]["Enums"]["exam_status"]
          student_id: string
          tanggal?: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          mode?: Database["public"]["Enums"]["exam_mode"]
          nilai_akhir?: number
          nilai_aspek?: Json
          status?: Database["public"]["Enums"]["exam_status"]
          student_id?: string
          tanggal?: string
        }
        Relationships: [
          {
            foreignKeyName: "ujian_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "penguji"
      certification_status: "Belum Ujian" | "Lulus" | "Tidak Lulus"
      exam_mode: "Tahsin" | "Tahfizh"
      exam_status: "Lulus" | "Tidak Lulus"
      student_level: "Tahsin Dasar" | "Tahsin Lanjutan" | "Tahfizh"
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
      app_role: ["admin", "penguji"],
      certification_status: ["Belum Ujian", "Lulus", "Tidak Lulus"],
      exam_mode: ["Tahsin", "Tahfizh"],
      exam_status: ["Lulus", "Tidak Lulus"],
      student_level: ["Tahsin Dasar", "Tahsin Lanjutan", "Tahfizh"],
    },
  },
} as const
