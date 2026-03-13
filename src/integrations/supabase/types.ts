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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_fields: Json | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cash_flow_forecast: {
        Row: {
          actual_collected: number
          actual_paid: number
          created_at: string
          created_by: string | null
          expected_collection: number
          expected_invoicing: number
          id: string
          notes: string | null
          opening_balance: number
          period_month: number
          period_year: number
          planned_equipment: number
          planned_labor: number
          planned_overhead: number
          planned_purchases: number
          project_id: string | null
          updated_at: string
        }
        Insert: {
          actual_collected?: number
          actual_paid?: number
          created_at?: string
          created_by?: string | null
          expected_collection?: number
          expected_invoicing?: number
          id?: string
          notes?: string | null
          opening_balance?: number
          period_month: number
          period_year: number
          planned_equipment?: number
          planned_labor?: number
          planned_overhead?: number
          planned_purchases?: number
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_collected?: number
          actual_paid?: number
          created_at?: string
          created_by?: string | null
          expected_collection?: number
          expected_invoicing?: number
          id?: string
          notes?: string | null
          opening_balance?: number
          period_month?: number
          period_year?: number
          planned_equipment?: number
          planned_labor?: number
          planned_overhead?: number
          planned_purchases?: number
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_forecast_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          category: string | null
          checklist_id: string
          created_at: string
          id: string
          item_text: string
          notes: string | null
          order_index: number | null
          status: string | null
        }
        Insert: {
          category?: string | null
          checklist_id: string
          created_at?: string
          id?: string
          item_text: string
          notes?: string | null
          order_index?: number | null
          status?: string | null
        }
        Update: {
          category?: string | null
          checklist_id?: string
          created_at?: string
          id?: string
          item_text?: string
          notes?: string | null
          order_index?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "inspection_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          phase_id: string | null
          reference_id: string
          reference_type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          payment_id: string
          phase_id?: string | null
          reference_id: string
          reference_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          phase_id?: string | null
          reference_id?: string
          reference_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "client_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payment_allocations_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          credit_used: number
          date: string
          id: string
          notes: string | null
          payment_method: string | null
          payment_type: string
          project_id: string
          treasury_id: string
          updated_at: string
          used_amount: number
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          credit_used?: number
          date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_type?: string
          project_id: string
          treasury_id: string
          updated_at?: string
          used_amount?: number
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          credit_used?: number
          date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_type?: string
          project_id?: string
          treasury_id?: string
          updated_at?: string
          used_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          cloudinary_api_key: string | null
          cloudinary_cloud_name: string | null
          cloudinary_upload_preset: string | null
          company_logo: string | null
          company_name: string
          contract_accent_color: string | null
          contract_background: string | null
          contract_bg_pos_x_mm: number | null
          contract_bg_pos_y_mm: number | null
          contract_bg_scale_percent: number | null
          contract_font_size_body: number | null
          contract_font_size_title: number | null
          contract_footer_bottom_mm: number | null
          contract_footer_enabled: boolean | null
          contract_footer_height_mm: number | null
          contract_header_bg_color: string | null
          contract_header_text_color: string | null
          contract_logo_position: string | null
          contract_padding_bottom_mm: number | null
          contract_padding_left_mm: number | null
          contract_padding_right_mm: number | null
          contract_padding_top_mm: number | null
          contract_show_clauses: boolean | null
          contract_show_description: boolean | null
          contract_show_items_table: boolean | null
          contract_show_project_info: boolean | null
          contract_show_signatures: boolean | null
          contract_signature_labels: Json | null
          contract_title_text: string | null
          created_at: string
          freeimage_api_key: string | null
          id: string
          image_upload_provider: string
          imgbb_api_key: string | null
          postimages_api_key: string | null
          print_border_radius: number | null
          print_border_width: number | null
          print_cell_padding: number | null
          print_header_font_size: number | null
          print_header_text_color: string | null
          print_labels: Json | null
          print_section_title_color: string | null
          print_table_border_color: string | null
          print_table_font_size: number | null
          print_table_header_color: string | null
          print_table_row_even_color: string | null
          print_table_row_odd_color: string | null
          print_table_text_color: string | null
          print_title_font_size: number | null
          report_background: string | null
          report_bg_pos_x_mm: number | null
          report_bg_pos_y_mm: number | null
          report_bg_scale_percent: number | null
          report_content_max_height_mm: number | null
          report_footer_bottom_mm: number | null
          report_footer_enabled: boolean | null
          report_footer_height_mm: number | null
          report_padding_bottom_mm: number | null
          report_padding_left_mm: number | null
          report_padding_right_mm: number | null
          report_padding_top_mm: number | null
          theme_color: string | null
          updated_at: string
        }
        Insert: {
          cloudinary_api_key?: string | null
          cloudinary_cloud_name?: string | null
          cloudinary_upload_preset?: string | null
          company_logo?: string | null
          company_name?: string
          contract_accent_color?: string | null
          contract_background?: string | null
          contract_bg_pos_x_mm?: number | null
          contract_bg_pos_y_mm?: number | null
          contract_bg_scale_percent?: number | null
          contract_font_size_body?: number | null
          contract_font_size_title?: number | null
          contract_footer_bottom_mm?: number | null
          contract_footer_enabled?: boolean | null
          contract_footer_height_mm?: number | null
          contract_header_bg_color?: string | null
          contract_header_text_color?: string | null
          contract_logo_position?: string | null
          contract_padding_bottom_mm?: number | null
          contract_padding_left_mm?: number | null
          contract_padding_right_mm?: number | null
          contract_padding_top_mm?: number | null
          contract_show_clauses?: boolean | null
          contract_show_description?: boolean | null
          contract_show_items_table?: boolean | null
          contract_show_project_info?: boolean | null
          contract_show_signatures?: boolean | null
          contract_signature_labels?: Json | null
          contract_title_text?: string | null
          created_at?: string
          freeimage_api_key?: string | null
          id?: string
          image_upload_provider?: string
          imgbb_api_key?: string | null
          postimages_api_key?: string | null
          print_border_radius?: number | null
          print_border_width?: number | null
          print_cell_padding?: number | null
          print_header_font_size?: number | null
          print_header_text_color?: string | null
          print_labels?: Json | null
          print_section_title_color?: string | null
          print_table_border_color?: string | null
          print_table_font_size?: number | null
          print_table_header_color?: string | null
          print_table_row_even_color?: string | null
          print_table_row_odd_color?: string | null
          print_table_text_color?: string | null
          print_title_font_size?: number | null
          report_background?: string | null
          report_bg_pos_x_mm?: number | null
          report_bg_pos_y_mm?: number | null
          report_bg_scale_percent?: number | null
          report_content_max_height_mm?: number | null
          report_footer_bottom_mm?: number | null
          report_footer_enabled?: boolean | null
          report_footer_height_mm?: number | null
          report_padding_bottom_mm?: number | null
          report_padding_left_mm?: number | null
          report_padding_right_mm?: number | null
          report_padding_top_mm?: number | null
          theme_color?: string | null
          updated_at?: string
        }
        Update: {
          cloudinary_api_key?: string | null
          cloudinary_cloud_name?: string | null
          cloudinary_upload_preset?: string | null
          company_logo?: string | null
          company_name?: string
          contract_accent_color?: string | null
          contract_background?: string | null
          contract_bg_pos_x_mm?: number | null
          contract_bg_pos_y_mm?: number | null
          contract_bg_scale_percent?: number | null
          contract_font_size_body?: number | null
          contract_font_size_title?: number | null
          contract_footer_bottom_mm?: number | null
          contract_footer_enabled?: boolean | null
          contract_footer_height_mm?: number | null
          contract_header_bg_color?: string | null
          contract_header_text_color?: string | null
          contract_logo_position?: string | null
          contract_padding_bottom_mm?: number | null
          contract_padding_left_mm?: number | null
          contract_padding_right_mm?: number | null
          contract_padding_top_mm?: number | null
          contract_show_clauses?: boolean | null
          contract_show_description?: boolean | null
          contract_show_items_table?: boolean | null
          contract_show_project_info?: boolean | null
          contract_show_signatures?: boolean | null
          contract_signature_labels?: Json | null
          contract_title_text?: string | null
          created_at?: string
          freeimage_api_key?: string | null
          id?: string
          image_upload_provider?: string
          imgbb_api_key?: string | null
          postimages_api_key?: string | null
          print_border_radius?: number | null
          print_border_width?: number | null
          print_cell_padding?: number | null
          print_header_font_size?: number | null
          print_header_text_color?: string | null
          print_labels?: Json | null
          print_section_title_color?: string | null
          print_table_border_color?: string | null
          print_table_font_size?: number | null
          print_table_header_color?: string | null
          print_table_row_even_color?: string | null
          print_table_row_odd_color?: string | null
          print_table_text_color?: string | null
          print_title_font_size?: number | null
          report_background?: string | null
          report_bg_pos_x_mm?: number | null
          report_bg_pos_y_mm?: number | null
          report_bg_scale_percent?: number | null
          report_content_max_height_mm?: number | null
          report_footer_bottom_mm?: number | null
          report_footer_enabled?: boolean | null
          report_footer_height_mm?: number | null
          report_padding_bottom_mm?: number | null
          report_padding_left_mm?: number | null
          report_padding_right_mm?: number | null
          report_padding_top_mm?: number | null
          theme_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contract_clause_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_clauses: {
        Row: {
          content: string
          contract_id: string
          created_at: string
          id: string
          order_index: number
          title: string
        }
        Insert: {
          content: string
          contract_id: string
          created_at?: string
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          content?: string
          contract_id?: string
          created_at?: string
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_clauses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_items: {
        Row: {
          contract_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          notes: string | null
          order_index: number
          project_item_id: string | null
          quantity: number
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          order_index?: number
          project_item_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          project_item_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_items_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount: number
          attachments: Json | null
          client_id: string | null
          contract_number: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          phase_id: string | null
          project_id: string | null
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          attachments?: Json | null
          client_id?: string | null
          contract_number: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          phase_id?: string | null
          project_id?: string | null
          start_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attachments?: Json | null
          client_id?: string | null
          contract_number?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          phase_id?: string | null
          project_id?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          hire_date: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          salary: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          salary?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          salary?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      engineers: {
        Row: {
          created_at: string
          email: string | null
          engineer_type: string
          id: string
          license_number: string | null
          name: string
          notes: string | null
          phone: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          engineer_type?: string
          id?: string
          license_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          engineer_type?: string
          id?: string
          license_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          available_quantity: number
          category: string | null
          created_at: string
          current_condition: string
          daily_rental_rate: number
          description: string | null
          id: string
          image_url: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number
          serial_number: string | null
          total_quantity: number
          updated_at: string
        }
        Insert: {
          available_quantity?: number
          category?: string | null
          created_at?: string
          current_condition?: string
          daily_rental_rate?: number
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number
          serial_number?: string | null
          total_quantity?: number
          updated_at?: string
        }
        Update: {
          available_quantity?: number
          category?: string | null
          created_at?: string
          current_condition?: string
          daily_rental_rate?: number
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number
          serial_number?: string | null
          total_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      equipment_rentals: {
        Row: {
          created_at: string
          custody_id: string | null
          daily_rate: number
          damage_cost: number | null
          damage_notes: string | null
          end_date: string | null
          equipment_id: string
          fund_source: string | null
          id: string
          notes: string | null
          project_id: string | null
          start_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custody_id?: string | null
          daily_rate?: number
          damage_cost?: number | null
          damage_notes?: string | null
          end_date?: string | null
          equipment_id: string
          fund_source?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          start_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custody_id?: string | null
          daily_rate?: number
          damage_cost?: number | null
          damage_notes?: string | null
          end_date?: string | null
          equipment_id?: string
          fund_source?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          start_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_rentals_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_rentals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          invoice_number: string | null
          notes: string | null
          payment_method: string | null
          phase_id: string | null
          project_id: string | null
          subtype: string | null
          supplier_id: string | null
          technician_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_method?: string | null
          phase_id?: string | null
          project_id?: string | null
          subtype?: string | null
          supplier_id?: string | null
          technician_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_method?: string | null
          phase_id?: string | null
          project_id?: string | null
          subtype?: string | null
          supplier_id?: string | null
          technician_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      general_project_items: {
        Row: {
          category: string | null
          created_at: string
          default_unit_price: number
          description: string | null
          formula: string | null
          id: string
          measurement_config_id: string | null
          measurement_type: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_unit_price?: number
          description?: string | null
          formula?: string | null
          id?: string
          measurement_config_id?: string | null
          measurement_type?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_unit_price?: number
          description?: string | null
          formula?: string | null
          id?: string
          measurement_config_id?: string | null
          measurement_type?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "general_items_measurement_config_id_fkey"
            columns: ["measurement_config_id"]
            isOneToOne: false
            referencedRelation: "measurement_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          payment_method: string | null
          project_id: string | null
          reference_id: string | null
          status: string | null
          subtype: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          project_id?: string | null
          reference_id?: string | null
          status?: string | null
          subtype?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          project_id?: string | null
          reference_id?: string | null
          status?: string | null
          subtype?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_checklists: {
        Row: {
          checklist_type: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          inspection_date: string | null
          inspector_name: string | null
          notes: string | null
          overall_score: number | null
          phase_id: string | null
          project_id: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          checklist_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inspection_date?: string | null
          inspector_name?: string | null
          notes?: string | null
          overall_score?: number | null
          phase_id?: string | null
          project_id: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          checklist_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inspection_date?: string | null
          inspector_name?: string | null
          notes?: string | null
          overall_score?: number | null
          phase_id?: string | null
          project_id?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checklists_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category: string | null
          created_at: string
          current_stock: number
          id: string
          min_stock_level: number
          name: string
          notes: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_stock?: number
          id?: string
          min_stock_level?: number
          name: string
          notes?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          current_stock?: number
          id?: string
          min_stock_level?: number
          name?: string
          notes?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      measurement_configs: {
        Row: {
          components: Json | null
          created_at: string
          formula: string | null
          id: string
          is_default: boolean | null
          name: string
          notes: string | null
          unit_symbol: string
          updated_at: string
        }
        Insert: {
          components?: Json | null
          created_at?: string
          formula?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          notes?: string | null
          unit_symbol: string
          updated_at?: string
        }
        Update: {
          components?: Json | null
          created_at?: string
          formula?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          notes?: string | null
          unit_symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      phase_reference_seq: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_code: string | null
          created_at: string
          display_name: string | null
          email: string | null
          engineer_id: string | null
          id: string
          title: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          engineer_id?: string | null
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          access_code?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          engineer_id?: string | null
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      project_custody: {
        Row: {
          amount: number
          created_at: string
          date: string
          employee_id: string | null
          engineer_id: string | null
          holder_type: string
          id: string
          notes: string | null
          project_id: string | null
          remaining_amount: number | null
          spent_amount: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          employee_id?: string | null
          engineer_id?: string | null
          holder_type?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          remaining_amount?: number | null
          spent_amount?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          employee_id?: string | null
          engineer_id?: string | null
          holder_type?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          remaining_amount?: number | null
          spent_amount?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_item_technicians: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          project_item_id: string
          quantity: number | null
          rate: number | null
          rate_type: string | null
          technician_id: string
          total_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          project_item_id: string
          quantity?: number | null
          rate?: number | null
          rate_type?: string | null
          technician_id: string
          total_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          project_item_id?: string
          quantity?: number | null
          rate?: number | null
          rate_type?: string | null
          technician_id?: string
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_item_technicians_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_item_technicians_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      project_items: {
        Row: {
          component_values: Json | null
          created_at: string
          description: string | null
          engineer_id: string | null
          formula: string | null
          height: number | null
          id: string
          length: number | null
          measurement_config_id: string | null
          measurement_factor: number | null
          measurement_type: string
          name: string
          notes: string | null
          phase_id: string | null
          progress: number | null
          project_id: string
          quantity: number
          total_price: number
          unit_price: number
          updated_at: string
          width: number | null
        }
        Insert: {
          component_values?: Json | null
          created_at?: string
          description?: string | null
          engineer_id?: string | null
          formula?: string | null
          height?: number | null
          id?: string
          length?: number | null
          measurement_config_id?: string | null
          measurement_factor?: number | null
          measurement_type?: string
          name: string
          notes?: string | null
          phase_id?: string | null
          progress?: number | null
          project_id: string
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
          width?: number | null
        }
        Update: {
          component_values?: Json | null
          created_at?: string
          description?: string | null
          engineer_id?: string | null
          formula?: string | null
          height?: number | null
          id?: string
          length?: number | null
          measurement_config_id?: string | null
          measurement_factor?: number | null
          measurement_type?: string
          name?: string
          notes?: string | null
          phase_id?: string | null
          progress?: number | null
          project_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_items_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_measurement_config_id_fkey"
            columns: ["measurement_config_id"]
            isOneToOne: false
            referencedRelation: "measurement_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          has_percentage: boolean
          id: string
          name: string
          notes: string | null
          order_index: number
          percentage_value: number
          phase_category: string
          phase_number: number | null
          project_id: string
          reference_number: string | null
          start_date: string | null
          status: string
          treasury_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          has_percentage?: boolean
          id?: string
          name: string
          notes?: string | null
          order_index?: number
          percentage_value?: number
          phase_category?: string
          phase_number?: number | null
          project_id: string
          reference_number?: string | null
          start_date?: string | null
          status?: string
          treasury_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          has_percentage?: boolean
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          percentage_value?: number
          phase_category?: string
          phase_number?: number | null
          project_id?: string
          reference_number?: string | null
          start_date?: string | null
          status?: string
          treasury_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
        ]
      }
      project_schedules: {
        Row: {
          actual_cost: number | null
          actual_duration: number | null
          actual_end: string | null
          actual_start: string | null
          assigned_to: string | null
          baseline_end: string | null
          baseline_start: string | null
          created_at: string
          dependencies: string | null
          description: string | null
          id: string
          notes: string | null
          order_index: number | null
          percent_complete: number | null
          phase_id: string | null
          planned_cost: number | null
          planned_duration: number | null
          planned_end: string | null
          planned_start: string | null
          project_id: string
          status: string | null
          task_name: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          actual_duration?: number | null
          actual_end?: string | null
          actual_start?: string | null
          assigned_to?: string | null
          baseline_end?: string | null
          baseline_start?: string | null
          created_at?: string
          dependencies?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          order_index?: number | null
          percent_complete?: number | null
          phase_id?: string | null
          planned_cost?: number | null
          planned_duration?: number | null
          planned_end?: string | null
          planned_start?: string | null
          project_id: string
          status?: string | null
          task_name: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          actual_duration?: number | null
          actual_end?: string | null
          actual_start?: string | null
          assigned_to?: string | null
          baseline_end?: string | null
          baseline_start?: string | null
          created_at?: string
          dependencies?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          order_index?: number | null
          percent_complete?: number | null
          phase_id?: string | null
          planned_cost?: number | null
          planned_duration?: number | null
          planned_end?: string | null
          planned_start?: string | null
          project_id?: string
          status?: string | null
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_schedules_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_suppliers: {
        Row: {
          created_at: string
          id: string
          project_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_suppliers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_technicians: {
        Row: {
          created_at: string
          id: string
          project_id: string
          technician_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          technician_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_technicians_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_technicians_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          budget_type: string | null
          client_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          has_purchase_sections: boolean | null
          id: string
          image_url: string | null
          location: string | null
          name: string
          notes: string | null
          progress: number | null
          progress_tracking_enabled: boolean | null
          spent: number | null
          start_date: string | null
          status: string
          supervising_engineer_id: string | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          budget_type?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          has_purchase_sections?: boolean | null
          id?: string
          image_url?: string | null
          location?: string | null
          name: string
          notes?: string | null
          progress?: number | null
          progress_tracking_enabled?: boolean | null
          spent?: number | null
          start_date?: string | null
          status?: string
          supervising_engineer_id?: string | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          budget_type?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          has_purchase_sections?: boolean | null
          id?: string
          image_url?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          progress?: number | null
          progress_tracking_enabled?: boolean | null
          spent?: number | null
          start_date?: string | null
          status?: string
          supervising_engineer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_supervising_engineer_id_fkey"
            columns: ["supervising_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          commission: number
          created_at: string
          custody_id: string | null
          date: string
          fund_source: string | null
          id: string
          invoice_image_url: string | null
          invoice_number: string | null
          is_return: boolean
          items: Json | null
          notes: string | null
          paid_amount: number
          phase_id: string | null
          project_id: string | null
          purchase_section: string | null
          purchase_source: string
          rental_id: string | null
          return_for_purchase_id: string | null
          status: string | null
          supplier_id: string | null
          technician_id: string | null
          total_amount: number
          treasury_id: string | null
          updated_at: string
        }
        Insert: {
          commission?: number
          created_at?: string
          custody_id?: string | null
          date?: string
          fund_source?: string | null
          id?: string
          invoice_image_url?: string | null
          invoice_number?: string | null
          is_return?: boolean
          items?: Json | null
          notes?: string | null
          paid_amount?: number
          phase_id?: string | null
          project_id?: string | null
          purchase_section?: string | null
          purchase_source?: string
          rental_id?: string | null
          return_for_purchase_id?: string | null
          status?: string | null
          supplier_id?: string | null
          technician_id?: string | null
          total_amount?: number
          treasury_id?: string | null
          updated_at?: string
        }
        Update: {
          commission?: number
          created_at?: string
          custody_id?: string | null
          date?: string
          fund_source?: string | null
          id?: string
          invoice_image_url?: string | null
          invoice_number?: string | null
          is_return?: boolean
          items?: Json | null
          notes?: string | null
          paid_amount?: number
          phase_id?: string | null
          project_id?: string | null
          purchase_section?: string | null
          purchase_source?: string
          rental_id?: string | null
          return_for_purchase_id?: string | null
          status?: string | null
          supplier_id?: string | null
          technician_id?: string | null
          total_amount?: number
          treasury_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_custody_id_fkey"
            columns: ["custody_id"]
            isOneToOne: false
            referencedRelation: "project_custody"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "equipment_rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_return_for_purchase_id_fkey"
            columns: ["return_for_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_register: {
        Row: {
          contingency_plan: string | null
          created_at: string
          due_date: string | null
          estimated_cost_impact: number
          id: string
          impact: number
          mitigation_plan: string | null
          notes: string | null
          owner_id: string | null
          priority: string | null
          probability: number
          project_id: string | null
          review_date: string | null
          risk_category: string
          risk_description: string
          risk_score: number | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          contingency_plan?: string | null
          created_at?: string
          due_date?: string | null
          estimated_cost_impact?: number
          id?: string
          impact?: number
          mitigation_plan?: string | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          probability?: number
          project_id?: string | null
          review_date?: string | null
          risk_category?: string
          risk_description: string
          risk_score?: number | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          contingency_plan?: string | null
          created_at?: string
          due_date?: string | null
          estimated_cost_impact?: number
          id?: string
          impact?: number
          mitigation_plan?: string | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          probability?: number
          project_id?: string | null
          review_date?: string | null
          risk_category?: string
          risk_description?: string
          risk_score?: number | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_register_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          location: string | null
          material_id: string
          movement_type: string
          notes: string | null
          performed_by: string | null
          phase_id: string | null
          project_id: string | null
          quantity: number
          reference_number: string | null
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          material_id: string
          movement_type?: string
          notes?: string | null
          performed_by?: string | null
          phase_id?: string | null
          project_id?: string | null
          quantity: number
          reference_number?: string | null
          total_cost?: number | null
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          material_id?: string
          movement_type?: string
          notes?: string | null
          performed_by?: string | null
          phase_id?: string | null
          project_id?: string | null
          quantity?: number
          reference_number?: string | null
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_status: string | null
          phone: string | null
          total_purchases: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_status?: string | null
          phone?: string | null
          total_purchases?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_status?: string | null
          phone?: string | null
          total_purchases?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      technician_progress_records: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          project_item_id: string
          quantity_completed: number
          technician_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          project_item_id: string
          quantity_completed?: number
          technician_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          project_item_id?: string
          quantity_completed?: number
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_progress_records_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_progress_records_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          created_at: string
          daily_rate: number | null
          email: string | null
          hourly_rate: number | null
          id: string
          meter_rate: number | null
          name: string
          notes: string | null
          phone: string | null
          piece_rate: number | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          meter_rate?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          piece_rate?: number | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_rate?: number | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          meter_rate?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          piece_rate?: number | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          notes: string | null
          party_name: string | null
          project_id: string | null
          remaining_amount: number | null
          spent_amount: number | null
          status: string | null
          subtype: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          party_name?: string | null
          project_id?: string | null
          remaining_amount?: number | null
          spent_amount?: number | null
          status?: string | null
          subtype?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          party_name?: string | null
          project_id?: string | null
          remaining_amount?: number | null
          spent_amount?: number | null
          status?: string | null
          subtype?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      treasuries: {
        Row: {
          account_number: string | null
          balance: number
          bank_name: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          parent_id: string | null
          treasury_type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          balance?: number
          bank_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          parent_id?: string | null
          treasury_type?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          balance?: number
          bank_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          parent_id?: string | null
          treasury_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasuries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_transactions: {
        Row: {
          amount: number
          balance_after: number
          commission: number
          created_at: string
          date: string
          description: string
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          source: string | null
          source_details: string | null
          treasury_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          balance_after?: number
          commission?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source?: string | null
          source_details?: string | null
          treasury_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          balance_after?: number
          commission?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source?: string | null
          source_details?: string | null
          treasury_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_transactions_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
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
      variation_orders: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          original_amount: number | null
          phase_id: string | null
          project_id: string
          request_date: string | null
          requested_by: string | null
          revised_amount: number | null
          status: string | null
          time_impact_days: number | null
          title: string
          updated_at: string
          variation_amount: number | null
          vo_number: string
          vo_type: string | null
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          original_amount?: number | null
          phase_id?: string | null
          project_id: string
          request_date?: string | null
          requested_by?: string | null
          revised_amount?: number | null
          status?: string | null
          time_impact_days?: number | null
          title: string
          updated_at?: string
          variation_amount?: number | null
          vo_number: string
          vo_type?: string | null
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          original_amount?: number | null
          phase_id?: string | null
          project_id?: string
          request_date?: string | null
          requested_by?: string | null
          revised_amount?: number | null
          status?: string | null
          time_impact_days?: number | null
          title?: string
          updated_at?: string
          variation_amount?: number | null
          vo_number?: string
          vo_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variation_orders_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variation_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_access_code: { Args: never; Returns: string }
      get_dashboard_financial_summary: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sync_treasury_balance: {
        Args: { treasury_uuid: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "engineer" | "accountant" | "supervisor"
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
      app_role: ["admin", "engineer", "accountant", "supervisor"],
    },
  },
} as const
