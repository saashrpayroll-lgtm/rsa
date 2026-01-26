export type UserRole = 'rider' | 'hub_tech' | 'rsa_tech' | 'admin';

export interface UserProfile {
    id: string;
    role: UserRole;
    mobile: string;
    full_name?: string;
    chassis_number?: string;
    current_location?: {
        lat: number;
        lng: number;
    };
    hub_center?: {
        lat: number;
        lng: number;
    };
    performance_score?: number;
    force_password_change?: boolean;
    wallet_balance?: number;
    team_leader?: string;
    is_available?: boolean;
    last_active_at?: string;
    status?: 'active' | 'suspended';
}

export interface SystemSettings {
    id: string;
    auto_assign_enabled: boolean;
    rsa_routing_enabled: boolean;
    hub_routing_enabled: boolean;
    updated_at: string;
}

export type TicketType = 'RUNNING_REPAIR' | 'RSA';
export type TicketStatus = 'PENDING' | 'ACCEPTED' | 'ON_WAY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Ticket {
    id: string;
    ticket_id?: string; // Human readable ID
    rider_id: string;
    technician_id?: string;
    alternate_mobile?: string; // Optional alternate number
    location_address?: string;
    cancel_reason?: string;
    notes?: string;
    type: TicketType;
    status: TicketStatus;
    category: string;
    description?: string;
    location: {
        lat: number;
        lng: number;
    };
    images?: string[];
    voice_notes?: string[];
    ai_analysis?: {
        severity: string;
        priority: string;
        eta: string;
        suggested_action?: string;
    };
    technician_remarks?: string;
    rejection_reason?: string;
    completion_images?: string[];
    completion_voice_notes?: string[];
    customer_rating?: number;
    customer_feedback?: string;
    technician?: UserProfile;
    rider?: UserProfile;
    rider_snapshot?: {
        full_name: string;
        mobile: string;
        chassis_number: string;
        wallet_balance: number;
        team_leader_name: string;
        team_leader_mobile: string;
    };
    technician_voice_transcripts?: string[];
    accepted_at?: string;
    on_way_at?: string;
    in_progress_at?: string;
    completed_at?: string;
    parts_replaced?: string;
    is_paused?: boolean;
    created_at: string;
}

export interface RiderMaster {
    id: string;
    custom_rider_id?: string;
    full_name: string;
    mobile: string;
    chassis_number: string;
    wallet_balance: number;
    allotment_date: string;
    team_leader_name: string;
    team_leader_mobile: string;
    status?: 'active' | 'suspended';
    last_synced_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'INFO' | 'ALERT' | 'SUCCESS' | 'WARNING';
    reference_id?: string;
    is_read: boolean;
    created_at: string;
}
