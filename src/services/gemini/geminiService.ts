/**
 * Gemini AI Service
 * Encaminha a geração de mensagens e análises para a Cloud Function autenticada (aiGenerateCopy),
 * mantendo a chave Gemini protegida no servidor.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

export interface GeminiMessageParams {
  nomeCliente: string;
  valor: string;            // ex: "R$ 89,90"
  dataVencimento: string;   // ex: "05/03/2026"
  diasAtraso: number;       // >0 = atrasado, 0 = vence hoje, <0 = a vencer
  linkBoleto: string;
}

export interface GeminiBlockedMessageParams {
  nomeCliente: string;
  dataVencimento: string;  // ex: "05/03/2026" — fatura mais antiga
  totalFaturas: number;    // quantas faturas estão em aberto
  valorTotal: string;      // ex: "R$ 189,80" — soma de todas
  linkBoleto?: string;     // link de pagamento da fatura mais antiga (quando disponível)
}

export interface FinancialAnalysisParams {
  inflow: string;
  outflow: string;
  balance: string;
  debtTotal: string;
  period: string;
  topDebtors: Array<{ nome: string; valor: string }>;
}

export interface IndividualDebtParams {
  nomeCliente: string;
  valorOriginal: string;
  diasAtraso: number;
  dataVencimento: string;
  linkBoleto?: string;
}

type CopyTaskType = 'billing' | 'blocked' | 'financial_analysis' | 'individual_debt';

async function invokeAiCopy<T extends object>(task: CopyTaskType, payload: T): Promise<string | null> {
  try {
    const callable = httpsCallable<{ task: CopyTaskType; payload: T }, { text: string | null }>(
      functions,
      'aiGenerateCopy'
    );
    const result = await callable({ task, payload });
    return result.data?.text ?? null;
  } catch (error) {
    console.error(`❌ Erro ao chamar Cloud Function aiGenerateCopy (${task}):`, error);
    return null;
  }
}

/**
 * Gera uma mensagem de cobrança humanizada usando o Google Gemini via backend seguro.
 * Em caso de erro, retorna null para que o chamador use o fallback.
 */
export async function generateAIBillingMessage(params: GeminiMessageParams): Promise<string | null> {
  return invokeAiCopy('billing', params);
}

/**
 * Gera uma mensagem humanizada para cliente BLOQUEADO usando o Google Gemini via backend seguro.
 * Em caso de erro, retorna null para que o chamador use o fallback.
 */
export async function generateAIBlockedMessage(params: GeminiBlockedMessageParams): Promise<string | null> {
  return invokeAiCopy('blocked', params);
}

/**
 * Gera uma análise financeira humanizada para o gestor via backend seguro.
 */
export async function generateFinancialAnalysis(params: FinancialAnalysisParams): Promise<string | null> {
  return invokeAiCopy('financial_analysis', params);
}

/**
 * Gera uma abordagem de cobrança ÚNICA e hiper-humanizada para um devedor específico via backend seguro.
 */
export async function generateIndividualDebtMessage(params: IndividualDebtParams): Promise<string | null> {
  return invokeAiCopy('individual_debt', params);
}
