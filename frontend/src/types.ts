export interface PersonBrief {
  id: string;
  name: string;
  is_named: boolean;
  avatar_url?: string | null;
}

export interface FaceBrief {
  id: string;
  person_id: string;
  person_name: string;
  is_named: boolean;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
  crop_url: string;
}

export interface MediaItem {
  id: string;
  filename: string;
  media_type: "image" | "video";
  mime_type: string;
  file_size: number;
  width?: number | null;
  height?: number | null;
  duration_sec?: number | null;
  camera_make?: string | null;
  camera_model?: string | null;
  taken_at: string;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  location_name?: string | null;
  city?: string | null;
  country?: string | null;
  is_manual_location: boolean;
  trip_id?: string | null;
  outing_id?: string | null;
  outing_title?: string | null;
  thumb_map_url: string;
  thumb_web_url: string;
  original_url: string;
  people: PersonBrief[];
  faces: FaceBrief[];
}

export interface Person {
  id: string;
  name: string;
  is_named: boolean;
  photo_count: number;
  avatar_url?: string | null;
}

export interface Trip {
  id: string;
  title: string;
  subtitle?: string | null;
  city?: string | null;
  country?: string | null;
  start_date: string;
  end_date: string;
  center_lat: number;
  center_lng: number;
  cover_thumb_url?: string | null;
  media_count: number;
  is_manual?: boolean;
}

export interface Outing {
  id: string;
  trip_id?: string | null;
  title: string;
  city?: string | null;
  start_date: string;
  end_date: string;
  center_lat: number;
  center_lng: number;
  cover_thumb_url?: string | null;
  media_count: number;
  is_manual?: boolean;
}

export interface TimelineBucket {
  key: string;
  month: string;
  label: string;
  sublabel?: string | null;
  count: number;
  start_date: string;
  end_date: string;
}

export interface TimelineStats {
  min_date?: string | null;
  max_date?: string | null;
  total_count: number;
  geotagged_count: number;
  untagged_count: number;
  years: number[];
  buckets: TimelineBucket[];
  day_buckets: TimelineBucket[];
}

export interface ScanStatus {
  id: string;
  status: "running" | "completed" | "failed";
  total_files: number;
  processed_files: number;
  imported_files: number;
  skipped_files: number;
  message?: string | null;
}
