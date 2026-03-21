export interface SmartOltOnu {
  id: string;
  olt_id: string;
  board: string;
  pon_port: string;
  onu_id: string;
  sn: string;
  name: string;
  description: string;
  status: 'online' | 'offline' | 'los';
  onuid: string;
  onu_type: string;
  last_online_at?: string;
  last_offline_at?: string;
  mac?: string;
  latitude?: string;
  longitude?: string;
}

export interface SmartOltSignal {
  onu_id: string;
  rx_power: string;
  tx_power: string;
  olt_rx_power: string;
  rx_power_numeric: number;
  tx_power_numeric: number;
  olt_rx_power_numeric: number;
  updated_at: string;
}

export interface SmartOltOlt {
  id: string;
  name: string;
  ip: string;
  telnet_port: string;
  snmp_port: string;
  hardware_version?: string;
  software_version?: string;
  uptime?: string;
  temperature?: string;
}

export interface SmartOltResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface SmartOltListResponse<T> {
  status: boolean;
  message: string;
  onus?: T[];
  olts?: T[];
}
