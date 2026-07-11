export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: { id: string; username?: string | null; avatar_url?: string | null };
        Update: { username?: string | null; avatar_url?: string | null };
        Relationships: [];
      };
      gardens: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          rows: number;
          cols: number;
          sun_exposure: 'full_sun' | 'partial_sun' | 'shade';
          created_at: string;
          layout?: string | null;
          location_json?: string | null;
          year?: number | null;
        };
        Insert: { user_id: string; name: string; description?: string | null; rows?: number; cols?: number; sun_exposure?: 'full_sun' | 'partial_sun' | 'shade'; layout?: string | null; location_json?: string | null; year?: number | null };
        Update: { name?: string; description?: string | null; rows?: number; cols?: number; sun_exposure?: 'full_sun' | 'partial_sun' | 'shade'; layout?: string | null; location_json?: string | null; year?: number | null };
        Relationships: [];
      };
      plants: {
        Row: {
          id: string;
          garden_id: string;
          user_id: string;
          name: string;
          variety: string | null;
          row: number | null;
          col: number | null;
          planted_date: string | null;
          expected_harvest_date: string | null;
          last_watered: string | null;
          water_interval_days: number | null;
          health_status: 'healthy' | 'needs_water' | 'sick' | 'harvested' | 'dead';
          sun_requirement: 'full_sun' | 'partial_sun' | 'shade' | null;
          total_yield_grams: number;
          notes: string | null;
          created_at: string;
          quantity: number | null;
          is_filler: boolean;
        };
        Insert: {
          garden_id: string;
          user_id: string;
          name: string;
          variety?: string | null;
          row?: number | null;
          col?: number | null;
          planted_date?: string | null;
          expected_harvest_date?: string | null;
          last_watered?: string | null;
          water_interval_days?: number | null;
          health_status?: 'healthy' | 'needs_water' | 'sick' | 'harvested' | 'dead';
          sun_requirement?: 'full_sun' | 'partial_sun' | 'shade' | null;
          total_yield_grams?: number;
          notes?: string | null;
          quantity?: number | null;
          is_filler?: boolean;
        };
        Update: {
          name?: string;
          variety?: string | null;
          row?: number | null;
          col?: number | null;
          planted_date?: string | null;
          expected_harvest_date?: string | null;
          last_watered?: string | null;
          water_interval_days?: number | null;
          health_status?: 'healthy' | 'needs_water' | 'sick' | 'harvested' | 'dead';
          sun_requirement?: 'full_sun' | 'partial_sun' | 'shade' | null;
          total_yield_grams?: number;
          notes?: string | null;
          quantity?: number | null;
          is_filler?: boolean;
        };
        Relationships: [];
      };
      harvests: {
        Row: {
          id: string;
          plant_id: string;
          user_id: string;
          yield_grams: number;
          harvested_at: string;
          notes: string | null;
        };
        Insert: { plant_id: string; user_id: string; yield_grams: number; notes?: string | null };
        Update: { yield_grams?: number; notes?: string | null };
        Relationships: [];
      };
      plant_photos: {
        Row: {
          id: string;
          plant_id: string;
          user_id: string;
          storage_path: string;
          caption: string | null;
          taken_at: string;
        };
        Insert: { plant_id: string; user_id: string; storage_path: string; caption?: string | null };
        Update: { caption?: string | null };
        Relationships: [];
      };
      garden_shares: {
        Row: {
          id: string;
          garden_id: string;
          owner_id: string;
          shared_with_email: string;
          permission: 'view' | 'edit';
          created_at: string;
        };
        Insert: { garden_id: string; owner_id: string; shared_with_email: string; permission?: 'view' | 'edit' };
        Update: { permission?: 'view' | 'edit' };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Garden = Database['public']['Tables']['gardens']['Row'];
export type Plant = Database['public']['Tables']['plants']['Row'];
export type Harvest = Database['public']['Tables']['harvests']['Row'];
export type PlantPhoto = Database['public']['Tables']['plant_photos']['Row'];
export type GardenShare = Database['public']['Tables']['garden_shares']['Row'];
export type HealthStatus = Plant['health_status'];
