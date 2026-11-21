export type SmartOltOnuStatus =
  | 'online'
  | 'los'
  | 'power_fail'
  | 'offline'
  | 'login'
  | 'unknown';

export interface SmartOltOnu {
  id: string;
  unique_external_id?: string;
  olt_id: string;
  olt_name?: string;
  board: string;
  pon_port: string;
  onu_id: string;
  sn: string;
  name: string;
  description?: string;
  address?: string;
  contact?: string;
  status: SmartOltOnuStatus;
  raw_status?: string;
  onuid: string;
  onu_type?: string;
  zone_id?: string;
  odb_id?: string | null;
  last_status_change?: string;
  last_online_at?: string;
  last_offline_at?: string;
  mac?: string;
  latitude?: string;
  longitude?: string;
  signal_quality?: string;
  signal_1310?: string;
  signal_1490?: string;
  rx_power_numeric?: number | null;
  olt_rx_power_numeric?: number | null;
}

export interface SmartOltSignal {
  onu_id: string;
  rx_power: string;
  tx_power: string;
  olt_rx_power: string;
  rx_power_numeric: number | null;
  tx_power_numeric: number | null;
  olt_rx_power_numeric: number | null;
  signal_quality?: string;
  updated_at: string;
}

export interface SmartOltOltCounts {
  total: number;
  online: number;
  los: number;
  powerFail: number;
  offline: number;
}

export interface SmartOltOlt {
  id: string;
  name: string;
  ip: string;
  telnet_port: string;
  snmp_port: string;
  hardware_version?: string;
  software_version?: string;
  olt_type?: string;
  uptime?: string;
  temperature?: string;
  voltage?: number | null;
  voltage_read_at?: string | null;
  power_state?: string | null;
  onu_counts?: SmartOltOltCounts;
}

export interface SmartOltUnconfiguredOnu {
  pon_type?: string;
  board?: string;
  port?: string;
  pon_description?: string;
  onu?: string;
  sn?: string;
  onu_type_name?: string;
  onu_type_id?: string;
  olt_id?: string;
  olt_name?: string;
  first_seen_at?: string;
  last_seen_at?: string;
}

export type SmartOltMatchReason =
  | 'linked_id'
  | 'sn'
  | 'pppoe_exact'
  | 'pppoe_base'
  | 'full_name'
  | 'none';

export interface SmartOltClientMatchResult {
  onu: SmartOltOnu | null;
  matchScore: number;
  matchReason: SmartOltMatchReason;
  candidates: SmartOltOnu[];
  liveChecked: boolean;
}

export interface SmartOltOnuDiagnostics {
  onu: SmartOltOnu;
  details: {
    onu_type_name: string;
    zone_name: string;
    odb_name: string;
    mode: string;
    administrative_status: string;
    authorization_date: string;
    catv: string;
  } | null;
  speed_profiles: {
    download: string;
    upload: string;
  } | null;
  history_7d: {
    online_percent: number;
    interruptions: number;
    seconds: {
      online: number;
      los: number;
      power_fail: number;
      offline: number;
    };
  } | null;
}

export interface SmartOltOpticalRadarResponse {
  threshold: number;
  summary: {
    total: number;
    online: number;
    los: number;
    powerFail: number;
    offline: number;
    criticalSignal: number;
    unconfigured: number;
  };
  olts: SmartOltOlt[];
  items: SmartOltOnu[];
  unconfigured_onus: SmartOltUnconfiguredOnu[];
}

export interface SmartOltResponse<T> {
  status: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface SmartOltListResponse<T> {
  status: boolean;
  message?: string;
  total?: number;
  onus?: T[];
  olts?: T[];
}
