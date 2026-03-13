import axios, { AxiosInstance } from 'axios';
import { SmartOltOnu, SmartOltSignal, SmartOltListResponse, SmartOltResponse } from '@/types/smartOlt';

class SmartOltService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_SMARTOLT_API_KEY || '';
    const baseURL = import.meta.env.VITE_SMARTOLT_BASE_URL || 'https://api.smartolt.com/api/v2';

    this.client = axios.create({
      baseURL,
      headers: {
        'X-Token': this.apiKey,
        'Accept': 'application/json',
      },
      timeout: 15000,
    });
  }

  /**
   * Busca uma ONU pelo Serial Number ou MAC
   */
  async findOnu(query: string): Promise<SmartOltOnu | null> {
    try {
      console.log(`🔍 Buscando ONU no SmartOLT: ${query}...`);
      const response = await this.client.get<SmartOltListResponse<SmartOltOnu>>('/onus', {
        params: { search: query }
      });

      if (response.data.status && response.data.onus && response.data.onus.length > 0) {
        return response.data.onus[0];
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar ONU no SmartOLT:', error);
      return null;
    }
  }

  /**
   * Obtém os níveis de sinal (RX/TX) de uma ONU
   */
  async getOnuSignal(onuId: string): Promise<SmartOltSignal | null> {
    try {
      console.log(`📡 Obtendo sinal da ONU ID: ${onuId}...`);
      const response = await this.client.get<SmartOltResponse<SmartOltSignal>>(`/onus/${onuId}/signal`);

      if (response.data.status) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter sinal no SmartOLT:', error);
      return null;
    }
  }

  /**
   * Reinicia uma ONU
   */
  async rebootOnu(onuId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔄 Reiniciando ONU ID: ${onuId}...`);
      const response = await this.client.post<{ status: boolean; message: string }>(`/onus/${onuId}/reboot`);
      
      return {
        success: response.data.status,
        message: response.data.message
      };
    } catch (error: any) {
      console.error('Erro ao reiniciar ONU:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Falha ao processar comando de reboot.'
      };
    }
  }
}

export const smartOltService = new SmartOltService();
export default smartOltService;
