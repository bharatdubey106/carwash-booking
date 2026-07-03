export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: 'client' | 'owner' | 'admin';
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: 'client' | 'owner' | 'admin';
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: 'client' | 'owner' | 'admin';
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      centers: { Row: any; Insert: any; Update: any };
      services: { Row: any; Insert: any; Update: any };
      bookings: { Row: any; Insert: any; Update: any };
      blocked_slots: { Row: any; Insert: any; Update: any };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: 'client' | 'owner' | 'admin';
      booking_type: 'slot' | 'pickup';
      booking_status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
    };
  };
};