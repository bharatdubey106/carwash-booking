export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; role: 'client' | 'owner' | 'admin'; full_name: string; phone: string | null; avatar_url: string | null; created_at: string; updated_at: string; }; Insert: any; Update: any; };
      centers: { Row: { id: string; is_active: boolean; opens_at: string; closes_at: string; slot_duration_minutes: number; supports_pickup: boolean; owner_id: string; name: string; slug: string; description: string | null; address: string; city: string; latitude: number | null; longitude: number | null; phone: string; cover_image_url: string | null; pickup_radius_km: number | null; created_at: string; updated_at: string; }; Insert: any; Update: any; };
      services: { Row: { id: string; center_id: string; name: string; description: string | null; price: number; duration_minutes: number; category: string | null; image_url: string | null; is_active: boolean; created_at: string; updated_at: string; }; Insert: any; Update: any; };
      bookings: { Row: { id: string; client_id: string | null; center_id: string; service_id: string; booking_type: 'slot' | 'pickup'; status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'; booking_date: string; slot_time: string; customer_name: string; customer_phone: string; booking_source: string; pickup_address: string | null; pickup_latitude: number | null; pickup_longitude: number | null; vehicle_make: string | null; vehicle_model: string | null; vehicle_plate: string | null; notes: string | null; price_at_booking: number; created_at: string; updated_at: string; }; Insert: any; Update: any; };
      blocked_slots: { Row: { id: string; center_id: string; blocked_date: string; slot_time: string | null; reason: string | null; created_by: string; created_at: string; }; Insert: any; Update: any; };
      platform_settings: { Row: { id: boolean; whatsapp_number: string; default_slot_interval_minutes: number; max_advance_days: number; updated_at: string; }; Insert: any; Update: any; };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { user_role: 'client' | 'owner' | 'admin'; booking_type: 'slot' | 'pickup'; booking_status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'; };
  };
};