import type { BusinessTables, BusinessViews } from './businessTypes'
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
    Tables: BusinessTables & {
      customer_invoices: {
        Row: {
          id: string; client_id: string; project_id: string | null; document_type: string;
          source_key: string; invoice_number: string | null; invoice_date: string | null;
          title: string; lines: Json; subtotal: number; fee_percentage: number; fee_amount: number;
          amount: number; source_filename: string | null; notes: string | null;
          status: Database["public"]["Enums"]["record_status"]; reversed_at: string | null;
          reversed_by: string | null; reversal_reason: string | null; idempotency_key: string;
          created_by: string | null; created_at: string;
        }
        Insert: never
        Update: never
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      catalog_item_requirements: {
        Row: {
          catalog_item_id: string
          required_count: number
          technician_type_id: string
        }
        Insert: {
          catalog_item_id: string
          required_count: number
          technician_type_id: string
        }
        Update: {
          catalog_item_id?: string
          required_count?: number
          technician_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_requirements_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_requirements_technician_type_id_fkey"
            columns: ["technician_type_id"]
            isOneToOne: false
            referencedRelation: "technician_types"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          category: string | null
          created_at: string
          default_unit_price: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_unit_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_unit_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "measurement_units"
            referencedColumns: ["id"]
          },
        ]
      }
      clause_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          title: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          title: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          title?: string
        }
        Relationships: []
      }
      client_credit_entries: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string | null
          kind: Database["public"]["Enums"]["credit_entry_kind"]
          notes: string | null
          project_id: string | null
          receipt_id: string | null
          reverses_entry_id: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          kind: Database["public"]["Enums"]["credit_entry_kind"]
          notes?: string | null
          project_id?: string | null
          receipt_id?: string | null
          reverses_entry_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["credit_entry_kind"]
          notes?: string | null
          project_id?: string | null
          receipt_id?: string | null
          reverses_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_credit_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_credit_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_credit_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_credit_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credit_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_credit_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_credit_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_credit_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credit_entries_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "client_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credit_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: true
            referencedRelation: "client_credit_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      client_receipts: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          project_id: string | null
          receipt_date: string
          receipt_no: number
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          treasury_id: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          project_id?: string | null
          receipt_date: string
          receipt_no?: number
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          treasury_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          project_id?: string | null
          receipt_date?: string
          receipt_no?: number
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          treasury_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_credit_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_receipts_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_receipts_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
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
          address: string | null
          allow_negative_treasury: boolean
          company_name: string
          google_drive_folder_url: string | null
          id: number
          logo_path: string | null
          phone: string | null
          print_settings: Json
          signee_name: string | null
          signee_title: string | null
          storage_provider: Database["public"]["Enums"]["storage_provider"]
          tagline: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_negative_treasury?: boolean
          company_name?: string
          google_drive_folder_url?: string | null
          id?: number
          logo_path?: string | null
          phone?: string | null
          print_settings?: Json
          signee_name?: string | null
          signee_title?: string | null
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_negative_treasury?: boolean
          company_name?: string
          google_drive_folder_url?: string | null
          id?: number
          logo_path?: string | null
          phone?: string | null
          print_settings?: Json
          signee_name?: string | null
          signee_title?: string | null
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contract_clauses: {
        Row: {
          content: string
          contract_id: string
          id: string
          order_index: number
          title: string
        }
        Insert: {
          content: string
          contract_id: string
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          content?: string
          contract_id?: string
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
          description: string | null
          id: string
          name: string
          order_index: number
          project_item_id: string | null
          quantity: number
          total_price: number | null
          unit_price: number
        }
        Insert: {
          contract_id: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          project_item_id?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number
        }
        Update: {
          contract_id?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          project_item_id?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number
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
            referencedRelation: "project_item_profitability"
            referencedColumns: ["project_item_id"]
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
          client_id: string
          contract_number: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          phase_id: string | null
          project_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          contract_number?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          phase_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          contract_number?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          phase_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_credit_balances"
            referencedColumns: ["client_id"]
          },
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
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
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
      custodies: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          employee_id: string | null
          engineer_id: string | null
          id: string
          idempotency_key: string
          is_closed: boolean
          issue_date: string
          project_id: string | null
          purpose: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          treasury_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          engineer_id?: string | null
          id?: string
          idempotency_key: string
          is_closed?: boolean
          issue_date: string
          project_id?: string | null
          purpose?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          treasury_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          engineer_id?: string | null
          id?: string
          idempotency_key?: string
          is_closed?: boolean
          issue_date?: string
          project_id?: string | null
          purpose?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          treasury_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodies_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodies_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodies_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodies_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
        ]
      }
      custody_returns: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          custody_id: string
          id: string
          idempotency_key: string
          notes: string | null
          return_date: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          treasury_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          custody_id: string
          id?: string
          idempotency_key: string
          notes?: string | null
          return_date: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          treasury_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          custody_id?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          return_date?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          treasury_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_returns_custody_id_fkey"
            columns: ["custody_id"]
            isOneToOne: false
            referencedRelation: "custodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_returns_custody_id_fkey"
            columns: ["custody_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["custody_id"]
          },
          {
            foreignKeyName: "custody_returns_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_returns_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
        ]
      }
      employees: {
        Row: {
          base_salary: number
          created_at: string
          department: string | null
          email: string | null
          hire_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          base_salary?: number
          created_at?: string
          department?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          base_salary?: number
          created_at?: string
          department?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      engineers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          license_number: string | null
          name: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          license_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          license_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          attachment_path: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          custody_id: string | null
          description: string
          expense_date: string
          id: string
          idempotency_key: string
          invoice_no: string | null
          notes: string | null
          phase_id: string | null
          project_id: string | null
          project_item_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          treasury_id: string | null
        }
        Insert: {
          amount: number
          attachment_path?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          custody_id?: string | null
          description: string
          expense_date: string
          id?: string
          idempotency_key: string
          invoice_no?: string | null
          notes?: string | null
          phase_id?: string | null
          project_id?: string | null
          project_item_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          treasury_id?: string | null
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          custody_id?: string | null
          description?: string
          expense_date?: string
          id?: string
          idempotency_key?: string
          invoice_no?: string | null
          notes?: string | null
          phase_id?: string | null
          project_id?: string | null
          project_item_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          treasury_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_custody_id_fkey"
            columns: ["custody_id"]
            isOneToOne: false
            referencedRelation: "custodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_custody_id_fkey"
            columns: ["custody_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["custody_id"]
          },
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
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_item_profitability"
            referencedColumns: ["project_item_id"]
          },
          {
            foreignKeyName: "expenses_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
        ]
      }
      measurement_units: {
        Row: {
          components: Json
          created_at: string
          factor: number
          id: string
          name: string
          symbol: string
        }
        Insert: {
          components?: Json
          created_at?: string
          factor?: number
          id?: string
          name: string
          symbol: string
        }
        Update: {
          components?: Json
          created_at?: string
          factor?: number
          id?: string
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      phase_reference_counters: {
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
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      project_item_assignments: {
        Row: {
          agreed_rate: number | null
          created_at: string
          id: string
          notes: string | null
          planned_quantity: number | null
          project_item_id: string
          rate_unit: Database["public"]["Enums"]["rate_unit"] | null
          technician_id: string
        }
        Insert: {
          agreed_rate?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_quantity?: number | null
          project_item_id: string
          rate_unit?: Database["public"]["Enums"]["rate_unit"] | null
          technician_id: string
        }
        Update: {
          agreed_rate?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_quantity?: number | null
          project_item_id?: string
          rate_unit?: Database["public"]["Enums"]["rate_unit"] | null
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_item_assignments_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_item_profitability"
            referencedColumns: ["project_item_id"]
          },
          {
            foreignKeyName: "project_item_assignments_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_item_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_balances"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "project_item_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      project_item_requirements: {
        Row: {
          project_item_id: string
          required_count: number
          technician_type_id: string
        }
        Insert: {
          project_item_id: string
          required_count: number
          technician_type_id: string
        }
        Update: {
          project_item_id?: string
          required_count?: number
          technician_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_item_requirements_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_item_profitability"
            referencedColumns: ["project_item_id"]
          },
          {
            foreignKeyName: "project_item_requirements_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_item_requirements_technician_type_id_fkey"
            columns: ["technician_type_id"]
            isOneToOne: false
            referencedRelation: "technician_types"
            referencedColumns: ["id"]
          },
        ]
      }
      project_items: {
        Row: {
          catalog_item_id: string | null
          created_at: string
          description: string | null
          dimensions: Json
          engineer_id: string | null
          id: string
          name: string
          order_index: number
          phase_id: string | null
          progress: number
          project_id: string
          base_quantity?: number | null
          cubic_factor?: number
          quantity: number
          total_price: number | null
          unit_id: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          catalog_item_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: Json
          engineer_id?: string | null
          id?: string
          name: string
          order_index?: number
          phase_id?: string | null
          progress?: number
          project_id: string
          base_quantity?: number | null
          cubic_factor?: number
          quantity: number
          total_price?: number | null
          unit_id?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: Json
          engineer_id?: string | null
          id?: string
          name?: string
          order_index?: number
          phase_id?: string | null
          progress?: number
          project_id?: string
          base_quantity?: number | null
          cubic_factor?: number
          quantity?: number
          total_price?: number | null
          unit_id?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
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
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "measurement_units"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          order_index: number
          project_id: string
          reference_number: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["phase_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          order_index?: number
          project_id: string
          reference_number?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          order_index?: number
          project_id?: string
          reference_number?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          budget_type: Database["public"]["Enums"]["budget_type"] | null
          client_id: string
          created_at: string
          default_treasury_id: string | null
          description: string | null
          end_date: string | null
          finishing_percentage: number | null
          id: string
          image_path: string | null
          location: string | null
          name: string
          notes: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          supervising_engineer_id: string | null
          supervision_mode: Database["public"]["Enums"]["supervision_mode"]
          supervision_value: number | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          budget_type?: Database["public"]["Enums"]["budget_type"] | null
          client_id: string
          created_at?: string
          default_treasury_id?: string | null
          description?: string | null
          end_date?: string | null
          finishing_percentage?: number | null
          id?: string
          image_path?: string | null
          location?: string | null
          name: string
          notes?: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supervising_engineer_id?: string | null
          supervision_mode?: Database["public"]["Enums"]["supervision_mode"]
          supervision_value?: number | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          budget_type?: Database["public"]["Enums"]["budget_type"] | null
          client_id?: string
          created_at?: string
          default_treasury_id?: string | null
          description?: string | null
          end_date?: string | null
          finishing_percentage?: number | null
          id?: string
          image_path?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supervising_engineer_id?: string | null
          supervision_mode?: Database["public"]["Enums"]["supervision_mode"]
          supervision_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_credit_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_default_treasury_id_fkey"
            columns: ["default_treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_default_treasury_id_fkey"
            columns: ["default_treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
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
          attachment_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          idempotency_key: string
          invoice_date: string
          invoice_no: string | null
          kind: Database["public"]["Enums"]["purchase_kind"]
          lines: Json
          notes: string | null
          phase_id: string | null
          project_id: string | null
          project_item_id: string | null
          returns_purchase_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          supplier_id: string
          total_amount: number
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idempotency_key: string
          invoice_date: string
          invoice_no?: string | null
          kind: Database["public"]["Enums"]["purchase_kind"]
          lines?: Json
          notes?: string | null
          phase_id?: string | null
          project_id?: string | null
          project_item_id?: string | null
          returns_purchase_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          supplier_id: string
          total_amount: number
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string
          invoice_date?: string
          invoice_no?: string | null
          kind?: Database["public"]["Enums"]["purchase_kind"]
          lines?: Json
          notes?: string | null
          phase_id?: string | null
          project_id?: string | null
          project_item_id?: string | null
          returns_purchase_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          supplier_id?: string
          total_amount?: number
        }
        Relationships: [
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
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_item_profitability"
            referencedColumns: ["project_item_id"]
          },
          {
            foreignKeyName: "purchases_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_returns_purchase_id_fkey"
            columns: ["returns_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchase_balances"
            referencedColumns: ["purchase_id"]
          },
          {
            foreignKeyName: "purchases_returns_purchase_id_fkey"
            columns: ["returns_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          payment_id: string
          purchase_id: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          payment_id: string
          purchase_id: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          payment_id?: string
          purchase_id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "supplier_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchase_balances"
            referencedColumns: ["purchase_id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          supplier_id: string
          treasury_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          supplier_id: string
          treasury_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          supplier_id?: string
          treasury_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
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
          phone: string | null
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
          phone?: string | null
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
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      technician_payments: {
        Row: {
          amount: number
          context_project_id: string | null
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          technician_id: string
          treasury_id: string
        }
        Insert: {
          amount: number
          context_project_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          technician_id: string
          treasury_id: string
        }
        Update: {
          amount?: number
          context_project_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          technician_id?: string
          treasury_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_payments_context_project_id_fkey"
            columns: ["context_project_id"]
            isOneToOne: false
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "technician_payments_context_project_id_fkey"
            columns: ["context_project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "technician_payments_context_project_id_fkey"
            columns: ["context_project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "technician_payments_context_project_id_fkey"
            columns: ["context_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_payments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_balances"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "technician_payments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_payments_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_payments_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
        ]
      }
      technician_receipts: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          receipt_date: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          technician_id: string
          treasury_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          receipt_date: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          technician_id: string
          treasury_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          receipt_date?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          technician_id?: string
          treasury_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_receipts_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_balances"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "technician_receipts_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_receipts_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_receipts_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
        ]
      }
      technician_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      technician_work: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          idempotency_key: string
          phase_id: string | null
          project_id: string
          project_item_id: string | null
          quantity: number
          rate: number
          rate_unit: Database["public"]["Enums"]["rate_unit"]
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          technician_id: string
          work_date: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idempotency_key: string
          phase_id?: string | null
          project_id: string
          project_item_id?: string | null
          quantity: number
          rate: number
          rate_unit: Database["public"]["Enums"]["rate_unit"]
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          technician_id: string
          work_date: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string
          phase_id?: string | null
          project_id?: string
          project_item_id?: string | null
          quantity?: number
          rate?: number
          rate_unit?: Database["public"]["Enums"]["rate_unit"]
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          technician_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_work_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_work_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "technician_work_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "technician_work_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "technician_work_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_work_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_item_profitability"
            referencedColumns: ["project_item_id"]
          },
          {
            foreignKeyName: "technician_work_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_work_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_balances"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "technician_work_technician_id_fkey"
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
          default_rate: number | null
          default_rate_unit: Database["public"]["Enums"]["rate_unit"] | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          technician_type_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_rate?: number | null
          default_rate_unit?: Database["public"]["Enums"]["rate_unit"] | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          technician_type_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_rate?: number | null
          default_rate_unit?: Database["public"]["Enums"]["rate_unit"] | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          technician_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technicians_technician_type_id_fkey"
            columns: ["technician_type_id"]
            isOneToOne: false
            referencedRelation: "technician_types"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          from_treasury_id: string
          id: string
          idempotency_key: string
          notes: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          to_treasury_id: string
          transfer_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          from_treasury_id: string
          id?: string
          idempotency_key: string
          notes?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          to_treasury_id: string
          transfer_date: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          from_treasury_id?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          to_treasury_id?: string
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_treasury_id_fkey"
            columns: ["from_treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_from_treasury_id_fkey"
            columns: ["from_treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
          {
            foreignKeyName: "transfers_to_treasury_id_fkey"
            columns: ["to_treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_treasury_id_fkey"
            columns: ["to_treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
        ]
      }
      treasuries: {
        Row: {
          account_number: string | null
          bank_name: string | null
          created_at: string
          domain: Database["public"]["Enums"]["treasury_domain"]
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["treasury_kind"]
          name: string
          notes: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          domain: Database["public"]["Enums"]["treasury_domain"]
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["treasury_kind"]
          name: string
          notes?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          domain?: Database["public"]["Enums"]["treasury_domain"]
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["treasury_kind"]
          name?: string
          notes?: string | null
          parent_id?: string | null
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
          {
            foreignKeyName: "treasuries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
        ]
      }
      treasury_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          direction: string
          entry_date: string
          id: string
          memo: string | null
          reverses_entry_id: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["entry_source"]
          treasury_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          direction: string
          entry_date: string
          id?: string
          memo?: string | null
          reverses_entry_id?: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["entry_source"]
          treasury_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          direction?: string
          entry_date?: string
          id?: string
          memo?: string | null
          reverses_entry_id?: string | null
          source_id?: string
          source_type?: Database["public"]["Enums"]["entry_source"]
          treasury_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: true
            referencedRelation: "treasury_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_entries_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_entries_treasury_id_fkey"
            columns: ["treasury_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: BusinessViews & {
      client_balances: {
        Row: {
          available_credit: number | null
          client_id: string | null
          name: string | null
          total_collected: number | null
          total_due: number | null
          total_obligation: number | null
          total_overpaid_on_projects: number | null
        }
        Relationships: []
      }
      client_credit_balances: {
        Row: {
          available_credit: number | null
          client_id: string | null
        }
        Relationships: []
      }
      custody_balances: {
        Row: {
          custody_id: string | null
          employee_id: string | null
          engineer_id: string | null
          is_closed: boolean | null
          issued: number | null
          project_id: string | null
          remaining: number | null
          returned: number | null
          spent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custodies_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodies_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_collections: {
        Row: {
          collected: number | null
          credit_applied: number | null
          moved_to_credit: number | null
          project_id: string | null
          receipts: number | null
        }
        Relationships: []
      }
      project_costs: {
        Row: {
          direct_cost: number | null
          expenses: number | null
          labor: number | null
          materials: number | null
          project_id: string | null
          returns: number | null
          services: number | null
        }
        Relationships: []
      }
      project_financials: {
        Row: {
          client_id: string | null
          client_obligation: number | null
          client_remaining: number | null
          collected: number | null
          company_fee: number | null
          contracts_total: number | null
          direct_cost: number | null
          earned_value: number | null
          expenses: number | null
          gross_profit_to_date: number | null
          items_total: number | null
          labor: number | null
          materials: number | null
          name: string | null
          project_id: string | null
          project_type: Database["public"]["Enums"]["project_type"] | null
          returns: number | null
          services: number | null
          status: Database["public"]["Enums"]["project_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_credit_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      project_item_profitability: {
        Row: {
          commercial_value: number | null
          earned_value: number | null
          expenses: number | null
          gross_profit_to_date: number | null
          incurred_cost: number | null
          labor: number | null
          name: string | null
          progress: number | null
          project_id: string | null
          project_item_id: string | null
          purchases: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
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
      project_item_staffing: {
        Row: {
          assigned_count: number | null
          missing_count: number | null
          project_item_id: string | null
          required_count: number | null
          technician_type_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_item_requirements_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_item_profitability"
            referencedColumns: ["project_item_id"]
          },
          {
            foreignKeyName: "project_item_requirements_project_item_id_fkey"
            columns: ["project_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_item_requirements_technician_type_id_fkey"
            columns: ["technician_type_id"]
            isOneToOne: false
            referencedRelation: "technician_types"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_balances: {
        Row: {
          kind: Database["public"]["Enums"]["purchase_kind"] | null
          paid: number | null
          project_id: string | null
          purchase_id: string | null
          remaining: number | null
          supplier_id: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_collections"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_balances: {
        Row: {
          balance_due: number | null
          invoiced: number | null
          name: string | null
          paid: number | null
          returned: number | null
          supplier_id: string | null
          unallocated_advance: number | null
        }
        Relationships: []
      }
      technician_balances: {
        Row: {
          balance_due: number | null
          earned: number | null
          name: string | null
          paid: number | null
          received_back: number | null
          technician_id: string | null
        }
        Relationships: []
      }
      treasury_balances: {
        Row: {
          balance: number | null
          domain: Database["public"]["Enums"]["treasury_domain"] | null
          is_active: boolean | null
          kind: Database["public"]["Enums"]["treasury_kind"] | null
          name: string | null
          parent_id: string | null
          treasury_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasuries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "treasuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasuries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "treasury_balances"
            referencedColumns: ["treasury_id"]
          },
        ]
      }
    }
    Functions: {
      business_command: { Args: { p_key: string; p_action: string; p_data: Json }; Returns: string }

      record_customer_invoice: { Args: { p_key: string; p_document: Json }; Returns: string }
      reverse_customer_invoice: { Args: { p_invoice_id: string; p_reason: string }; Returns: undefined }
      allocate_supplier_advance: {
        Args: { p_amount: number; p_payment_id: string; p_purchase_id: string }
        Returns: string
      }
      apply_client_credit: {
        Args: {
          p_amount: number
          p_client_id: string
          p_key: string
          p_notes?: string
          p_project_id: string
        }
        Returns: string
      }
      assert_project_belongs_to_client: {
        Args: { p_client_id: string; p_project_id: string }
        Returns: undefined
      }
      assert_project_refs: {
        Args: { p_item_id: string; p_phase_id: string; p_project_id: string }
        Returns: undefined
      }
      assert_reversible: {
        Args: {
          p_reason: string
          p_status: Database["public"]["Enums"]["record_status"]
        }
        Returns: undefined
      }
      assert_treasury_for_project: {
        Args: { p_project_id: string; p_treasury_id: string }
        Returns: undefined
      }
      close_custody: { Args: { p_custody_id: string }; Returns: undefined }
      delete_project_item: { Args: { p_item_id: string }; Returns: undefined }
      has_any_role: {
        Args: { roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_finance: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      issue_custody: {
        Args: {
          p_amount: number
          p_date: string
          p_employee_id?: string
          p_engineer_id?: string
          p_key: string
          p_project_id?: string
          p_purpose?: string
          p_treasury_id: string
        }
        Returns: string
      }
      move_project_overpayment_to_credit: {
        Args: {
          p_amount: number
          p_key: string
          p_notes?: string
          p_project_id: string
        }
        Returns: string
      }
      pay_supplier: {
        Args: {
          p_allocations?: Json
          p_amount: number
          p_date: string
          p_key: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_reference?: string
          p_supplier_id: string
          p_treasury_id: string
        }
        Returns: string
      }
      pay_technician: {
        Args: {
          p_amount: number
          p_context_project_id?: string
          p_date: string
          p_key: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_technician_id: string
          p_treasury_id: string
        }
        Returns: string
      }
      post_treasury_entry: {
        Args: {
          p_amount: number
          p_date: string
          p_direction: string
          p_memo?: string
          p_reverses?: string
          p_source_id: string
          p_source_type: Database["public"]["Enums"]["entry_source"]
          p_treasury_id: string
        }
        Returns: string
      }
      receive_from_technician: {
        Args: {
          p_amount: number
          p_date: string
          p_key: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_technician_id: string
          p_treasury_id: string
        }
        Returns: string
      }
      record_client_receipt: {
        Args: {
          p_amount: number
          p_client_id: string
          p_date: string
          p_key: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_project_id: string
          p_reference?: string
          p_treasury_id: string
        }
        Returns: string
      }
      record_expense: {
        Args: {
          p_amount: number
          p_attachment_path?: string
          p_category_id?: string
          p_custody_id?: string
          p_date: string
          p_description: string
          p_invoice_no?: string
          p_item_id?: string
          p_key: string
          p_notes?: string
          p_phase_id?: string
          p_project_id?: string
          p_treasury_id?: string
        }
        Returns: string
      }
      record_purchase: {
        Args: {
          p_attachment_path?: string
          p_date: string
          p_description?: string
          p_invoice_no?: string
          p_item_id?: string
          p_key: string
          p_kind: Database["public"]["Enums"]["purchase_kind"]
          p_lines?: Json
          p_notes?: string
          p_phase_id?: string
          p_project_id?: string
          p_returns_purchase_id?: string
          p_supplier_id: string
          p_total: number
        }
        Returns: string
      }
      record_technician_work: {
        Args: {
          p_date: string
          p_description?: string
          p_item_id?: string
          p_key: string
          p_phase_id?: string
          p_project_id: string
          p_quantity: number
          p_rate: number
          p_rate_unit: Database["public"]["Enums"]["rate_unit"]
          p_technician_id: string
        }
        Returns: string
      }
      require_finance: { Args: never; Returns: undefined }
      return_custody_cash: {
        Args: {
          p_amount: number
          p_custody_id: string
          p_date: string
          p_key: string
          p_notes?: string
          p_treasury_id: string
        }
        Returns: string
      }
      reverse_client_credit_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: undefined
      }
      reverse_client_receipt: {
        Args: { p_date?: string; p_reason: string; p_receipt_id: string }
        Returns: undefined
      }
      reverse_custody: {
        Args: { p_custody_id: string; p_date?: string; p_reason: string }
        Returns: undefined
      }
      reverse_custody_return: {
        Args: { p_date?: string; p_reason: string; p_return_id: string }
        Returns: undefined
      }
      reverse_expense: {
        Args: { p_date?: string; p_expense_id: string; p_reason: string }
        Returns: undefined
      }
      reverse_purchase: {
        Args: { p_purchase_id: string; p_reason: string }
        Returns: undefined
      }
      reverse_supplier_payment: {
        Args: { p_date?: string; p_payment_id: string; p_reason: string }
        Returns: undefined
      }
      reverse_technician_payment: {
        Args: { p_date?: string; p_payment_id: string; p_reason: string }
        Returns: undefined
      }
      reverse_technician_receipt: {
        Args: { p_date?: string; p_reason: string; p_receipt_id: string }
        Returns: undefined
      }
      reverse_technician_work: {
        Args: { p_reason: string; p_work_id: string }
        Returns: undefined
      }
      reverse_transfer: {
        Args: { p_date?: string; p_reason: string; p_transfer_id: string }
        Returns: undefined
      }
      reverse_treasury_entries: {
        Args: {
          p_date: string
          p_memo: string
          p_source_id: string
          p_source_type: Database["public"]["Enums"]["entry_source"]
        }
        Returns: undefined
      }
      set_opening_balance: {
        Args: { p_amount: number; p_date: string; p_treasury_id: string }
        Returns: string
      }
      save_treasury: {
        Args: { p_document: Json }
        Returns: string
      }
      transfer_between_treasuries: {
        Args: {
          p_amount: number
          p_date: string
          p_from: string
          p_key: string
          p_notes?: string
          p_to: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "accountant" | "engineer" | "supervisor"
      budget_type: "fixed" | "estimated"
      contract_status: "draft" | "active" | "completed" | "cancelled"
      credit_entry_kind:
        | "advance_receipt"
        | "from_project"
        | "application"
        | "reversal"
      entry_source:
        | "opening_balance"
        | "client_receipt"
        | "supplier_payment"
        | "technician_payment"
        | "technician_deposit"
        | "expense"
        | "transfer"
        | "custody_issue"
        | "custody_return"
        | "payroll_slip"
        | "employee_advance"
        | "advance_repayment"
      payment_method: "cash" | "bank_transfer" | "cheque" | "other"
      phase_status: "planned" | "in_progress" | "completed" | "on_hold"
      project_status:
        | "planned"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      project_type: "contracting" | "finishing"
      purchase_kind: "material" | "service" | "return"
      rate_unit: "day" | "hour" | "meter" | "piece" | "lump_sum"
      record_status: "posted" | "reversed"
      storage_provider: "supabase" | "google_drive"
      supervision_mode: "none" | "fixed_amount" | "percentage"
      treasury_domain: "contracting" | "finishing" | "general"
      treasury_kind: "cash" | "bank"
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
      app_role: ["admin", "accountant", "engineer", "supervisor"],
      budget_type: ["fixed", "estimated"],
      contract_status: ["draft", "active", "completed", "cancelled"],
      credit_entry_kind: [
        "advance_receipt",
        "from_project",
        "application",
        "reversal",
      ],
      entry_source: [
        "opening_balance",
        "client_receipt",
        "supplier_payment",
        "technician_payment",
        "technician_deposit",
        "expense",
        "transfer",
        "custody_issue",
        "custody_return",
        "payroll_slip",
        "employee_advance",
        "advance_repayment",
      ],
      payment_method: ["cash", "bank_transfer", "cheque", "other"],
      phase_status: ["planned", "in_progress", "completed", "on_hold"],
      project_status: [
        "planned",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      project_type: ["contracting", "finishing"],
      purchase_kind: ["material", "service", "return"],
      rate_unit: ["day", "hour", "meter", "piece", "lump_sum"],
      record_status: ["posted", "reversed"],
      storage_provider: ["supabase", "google_drive"],
      supervision_mode: ["none", "fixed_amount", "percentage"],
      treasury_domain: ["contracting", "finishing", "general"],
      treasury_kind: ["cash", "bank"],
    },
  },
} as const
