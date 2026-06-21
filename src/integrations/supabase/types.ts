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
      academic_semesters: {
        Row: {
          academic_year_id: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          semester_number: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          semester_number: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          semester_number?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_semesters_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_years: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      certificate_layouts: {
        Row: {
          id: string
          layout: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id: string
          layout: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          layout?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tahfizh_certificates: {
        Row: {
          certificate_number: string
          class_name_snapshot: string
          coordinator_name_snapshot: string | null
          coordinator_user_id: string | null
          created_at: string
          document_number: string | null
          final_score_snapshot: number
          id: string
          issued_date: string
          juz_snapshot: string
          layout_snapshot: Json | null
          predicate_snapshot: string
          principal_name_snapshot: string | null
          published_at: string
          published_by: string | null
          revision_note: string | null
          status: string
          student_id: string
          student_name_snapshot: string
          ujian_id: string
          updated_at: string
          verification_token: string | null
        }
        Insert: {
          certificate_number: string
          class_name_snapshot: string
          coordinator_name_snapshot?: string | null
          coordinator_user_id?: string | null
          created_at?: string
          document_number?: string | null
          final_score_snapshot: number
          id?: string
          issued_date: string
          juz_snapshot: string
          layout_snapshot?: Json | null
          predicate_snapshot: string
          principal_name_snapshot?: string | null
          published_at?: string
          published_by?: string | null
          revision_note?: string | null
          status?: string
          student_id: string
          student_name_snapshot: string
          ujian_id: string
          updated_at?: string
          verification_token?: string | null
        }
        Update: {
          certificate_number?: string
          class_name_snapshot?: string
          coordinator_name_snapshot?: string | null
          coordinator_user_id?: string | null
          created_at?: string
          document_number?: string | null
          final_score_snapshot?: number
          id?: string
          issued_date?: string
          juz_snapshot?: string
          layout_snapshot?: Json | null
          predicate_snapshot?: string
          principal_name_snapshot?: string | null
          published_at?: string
          published_by?: string | null
          revision_note?: string | null
          status?: string
          student_id?: string
          student_name_snapshot?: string
          ujian_id?: string
          updated_at?: string
          verification_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tahfizh_certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tahfizh_certificates_ujian_id_fkey"
            columns: ["ujian_id"]
            isOneToOne: true
            referencedRelation: "ujian"
            referencedColumns: ["id"]
          },
        ]
      }
      tahfizh_certificate_layout_overrides: {
        Row: {
          created_at: string
          id: string
          layout: Json
          student_id: string | null
          ujian_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          layout: Json
          student_id?: string | null
          ujian_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          student_id?: string | null
          ujian_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tahfizh_certificate_layout_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tahfizh_certificate_layout_overrides_ujian_id_fkey"
            columns: ["ujian_id"]
            isOneToOne: true
            referencedRelation: "ujian"
            referencedColumns: ["id"]
          },
        ]
      }
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
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_user_id: string
          relation: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_user_id: string
          relation?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_user_id?: string
          relation?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      penguji: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_classes: string[] | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name_certificate: string | null
          display_name_rapor: string | null
          email: string | null
          full_name: string
          id: string
          jabatan: string | null
          nip: string | null
          registered_at: string
          signature_url: string | null
          status: Database["public"]["Enums"]["account_status"]
          title: string | null
          updated_at: string
          username: string | null
          whatsapp: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_classes?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name_certificate?: string | null
          display_name_rapor?: string | null
          email?: string | null
          full_name?: string
          id: string
          jabatan?: string | null
          nip?: string | null
          registered_at?: string
          signature_url?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          title?: string | null
          updated_at?: string
          username?: string | null
          whatsapp?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_classes?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name_certificate?: string | null
          display_name_rapor?: string | null
          email?: string | null
          full_name?: string
          id?: string
          jabatan?: string | null
          nip?: string | null
          registered_at?: string
          signature_url?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          title?: string | null
          updated_at?: string
          username?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      setoran: {
        Row: {
          assessed_by: string | null
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
          assessed_by?: string | null
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
          assessed_by?: string | null
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
      student_class_history: {
        Row: {
          academic_year_from: string
          academic_year_to: string
          from_class_id: string | null
          id: string
          note: string | null
          promoted_at: string
          promoted_by: string | null
          status_after: string
          student_id: string
          to_class_id: string | null
        }
        Insert: {
          academic_year_from: string
          academic_year_to: string
          from_class_id?: string | null
          id?: string
          note?: string | null
          promoted_at?: string
          promoted_by?: string | null
          status_after: string
          student_id: string
          to_class_id?: string | null
        }
        Update: {
          academic_year_from?: string
          academic_year_to?: string
          from_class_id?: string | null
          id?: string
          note?: string | null
          promoted_at?: string
          promoted_by?: string | null
          status_after?: string
          student_id?: string
          to_class_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_class_history_academic_year_from_fkey"
            columns: ["academic_year_from"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_history_academic_year_to_fkey"
            columns: ["academic_year_to"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_history_from_class_id_fkey"
            columns: ["from_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_history_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_history_to_class_id_fkey"
            columns: ["to_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
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
          nis: string | null
          nisn: string | null
          progress_hafalan: number
          student_status: string
          status_siswa: string
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
          nis?: string | null
          nisn?: string | null
          progress_hafalan?: number
          student_status?: string
          status_siswa?: string
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
          nis?: string | null
          nisn?: string | null
          progress_hafalan?: number
          student_status?: string
          status_siswa?: string
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
          academic_year_id: string | null
          assessed_by: string | null
          class_name_at_exam: string | null
          created_at: string
          document_status: string
          grade: string
          grade_at_exam: number | null
          id: string
          mode: Database["public"]["Enums"]["exam_mode"]
          nilai_akhir: number
          nilai_aspek: Json
          nomor_sertifikat: string | null
          published_at: string | null
          status: Database["public"]["Enums"]["exam_status"]
          student_id: string
          tanggal: string
          verification_token: string
        }
        Insert: {
          academic_year_id?: string | null
          assessed_by?: string | null
          class_name_at_exam?: string | null
          created_at?: string
          document_status?: string
          grade?: string
          grade_at_exam?: number | null
          id?: string
          mode: Database["public"]["Enums"]["exam_mode"]
          nilai_akhir?: number
          nilai_aspek?: Json
          nomor_sertifikat?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          student_id: string
          tanggal?: string
          verification_token?: string
        }
        Update: {
          academic_year_id?: string | null
          assessed_by?: string | null
          class_name_at_exam?: string | null
          created_at?: string
          document_status?: string
          grade?: string
          grade_at_exam?: number | null
          id?: string
          mode?: Database["public"]["Enums"]["exam_mode"]
          nilai_akhir?: number
          nilai_aspek?: Json
          nomor_sertifikat?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          student_id?: string
          tanggal?: string
          verification_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "ujian_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
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
      admin_get_penguji_user_id: {
        Args: { _penguji_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_approved: { Args: { _uid: string }; Returns: boolean }
      process_mass_class_promotion: {
        Args: {
          _academic_year_from: string
          _academic_year_to: string
          _note?: string
          _student_ids: string[]
        }
        Returns: {
          from_class_id: string | null
          message: string | null
          result_status: string | null
          status_after: string | null
          student_id: string | null
          to_class_id: string | null
        }[]
      }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected" | "inactive"
      app_role: "admin" | "penguji" | "guru" | "parent"
      certification_status: "Belum Ujian" | "Lulus" | "Tidak Lulus"
      exam_mode: "Tahsin" | "Tahfizh" | "Tahsin Dasar" | "Tahsin Lanjutan"
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
      account_status: ["pending", "approved", "rejected", "inactive"],
      app_role: ["admin", "penguji", "guru", "parent"],
      certification_status: ["Belum Ujian", "Lulus", "Tidak Lulus"],
      exam_mode: ["Tahsin", "Tahfizh", "Tahsin Dasar", "Tahsin Lanjutan"],
      exam_status: ["Lulus", "Tidak Lulus"],
      student_level: ["Tahsin Dasar", "Tahsin Lanjutan", "Tahfizh"],
    },
  },
} as const
