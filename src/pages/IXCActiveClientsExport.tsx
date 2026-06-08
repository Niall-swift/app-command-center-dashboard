import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Download, 
  Loader2, 
  FileSpreadsheet, 
  Database, 
  CheckCircle, 
  Info, 
  HelpCircle, 
  FileText, 
  Settings2,
  ListFilter
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ixcService } from '@/services/ixc/ixcService';
import { IXCClienteData } from '@/types/ixc';
import { toast } from 'sonner';

interface ColumnOption {
  key: keyof IXCClienteData;
  label: string;
  description: string;
}

const AVAILABLE_COLUMNS: ColumnOption[] = [
  { key: 'id', label: 'ID', description: 'Identificador único no IXC' },
  { key: 'nome', label: 'Nome / Razão Social', description: 'Nome completo ou Razão Social cadastrada' },
  { key: 'tipo_pessoa', label: 'Tipo de Pessoa', description: 'Física (F) ou Jurídica (J)' },
  { key: 'cnpj_cpf', label: 'CPF / CNPJ', description: 'Documento nacional de identificação' },
  { key: 'email', label: 'E-mail', description: 'Endereço de e-mail de contato' },
  { key: 'fone_celular', label: 'Telefone Celular', description: 'Telefone de celular cadastrado' },
  { key: 'fone_whatsapp', label: 'WhatsApp', description: 'Telefone para contato via WhatsApp' },
  { key: 'fone_residencial', label: 'Telefone Fixo', description: 'Número de telefone residencial' },
  { key: 'plano' as any, label: 'Plano de Internet', description: 'Plano de internet ativo' },
  { key: 'vencimento' as any, label: 'Data de Vencimento', description: 'Próximo vencimento ou dia base' },
  { key: 'cep', label: 'CEP', description: 'Código postal de endereço' },
  { key: 'endereco', label: 'Endereço', description: 'Rua, número e complementos' },
  { key: 'bairro', label: 'Bairro', description: 'Bairro do endereço cadastrado' },
  { key: 'cidade', label: 'Cidade', description: 'Cidade de residência/atendimento' },
  { key: 'obs', label: 'Observações', description: 'Anotações gerais e cadastrais' },
];

export default function IXCActiveClientsExport() {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    AVAILABLE_COLUMNS.map(col => col.key as string)
  );
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [activeClients, setActiveClients] = useState<IXCClienteData[]>([]);
  const [delimiter, setDelimiter] = useState<';' | ','>(';');

  const getClientValue = (client: IXCClienteData, key: string): string => {
    if (key === 'nome') {
      return String(client.nome || client.razao || '');
    }
    if (key === 'fone_celular') {
      return String(
        client.fone_celular || 
        client.telefone_celular || 
        client.telefone || 
        client.whatsapp || 
        client.fone_whatsapp || 
        client.telefone_comercial || 
        ''
      );
    }
    if (key === 'fone_whatsapp') {
      return String(
        client.fone_whatsapp || 
        client.whatsapp || 
        client.telefone_celular || 
        client.fone_celular || 
        ''
      );
    }
    if (key === 'fone_residencial') {
      return String(
        client.fone_residencial || 
        client.telefone || 
        client.telefone_comercial || 
        client.fone_comercial || 
        ''
      );
    }
    const val = client[key];
    return val !== undefined && val !== null ? String(val) : '';
  };

  const handleToggleColumn = (columnKey: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnKey) 
        ? prev.filter(key => key !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleSelectAll = () => {
    if (selectedColumns.length === AVAILABLE_COLUMNS.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(AVAILABLE_COLUMNS.map(col => col.key as string));
    }
  };

  const handleFetchActiveClients = async () => {
    if (selectedColumns.length === 0) {
      toast.error('Selecione pelo menos uma coluna para a exportação.');
      return;
    }

    setLoading(true);
    setProgress(0);
    setLoadedCount(0);
    setActiveClients([]);
    setStatusMessage('Iniciando busca de clientes ativos...');

    try {
      // 1. Buscar clientes ativos
      const records = await ixcService.fetchAllClientesAtivos((total) => {
        setLoadedCount(total);
        setProgress(Math.min(30, Math.floor((total / 1000) * 30)));
        setStatusMessage(`Buscando clientes ativos... (${total} carregados)`);
      });

      if (records.length === 0) {
        toast.warning('Nenhum cliente ativo foi encontrado no sistema.');
        setStatusMessage('Busca finalizada. Nenhum registro encontrado.');
        setLoading(false);
        return;
      }

      // 2. Buscar contratos ativos
      setStatusMessage('Buscando planos contratados...');
      setProgress(40);
      const contracts = await ixcService.fetchAllContratosAtivos((totalContracts) => {
        setProgress(Math.min(70, 40 + Math.floor((totalContracts / 1000) * 30)));
        setStatusMessage(`Buscando contratos... (${totalContracts} carregados)`);
      });

      const clientContractsMap = new Map<string, any>();
      contracts.forEach(c => {
        if (c.id_cliente) {
          // Salva o contrato mais recente do cliente
          clientContractsMap.set(String(c.id_cliente), c);
        }
      });

      // 3. Enriquecer clientes com dados dos contratos e dia de vencimento
      setStatusMessage('Processando e vinculando dados...');
      setProgress(85);

      const enrichedRecords = records.map(client => {
        const contract = clientContractsMap.get(String(client.id));
        
        let plano = '';
        let vencimento = '';
        
        if (contract) {
          plano = contract.contrato || contract.plano || contract.descricao || '';
          
          // O dia de vencimento (dia fixo de cobrança) corresponde exatamente ao dia do campo pago_ate_data.
          // Quando o cliente realiza o pagamento, o IXC atualiza este campo para a data de vencimento daquele ciclo (ex: 2026-06-10).
          // Se o campo pago_ate_data for nulo, inválido ou '0000-00-00', usamos a data_ativacao como fallback.
          const refDate = (contract.pago_ate_data && contract.pago_ate_data !== '0000-00-00')
            ? contract.pago_ate_data
            : (contract.data_ativacao || '');

          if (refDate && refDate.includes('-')) {
            const parts = refDate.split('-');
            vencimento = parts.length === 3 ? `Dia ${parts[2]}` : refDate;
          } else {
            vencimento = 'Não definido';
          }
        } else {
          plano = 'Sem contrato ativo';
          vencimento = 'N/A';
        }

        return {
          ...client,
          plano,
          vencimento
        };
      });

      setActiveClients(enrichedRecords);
      setProgress(100);
      setStatusMessage(`Sucesso! ${enrichedRecords.length} clientes ativos carregados.`);
      toast.success(`${enrichedRecords.length} clientes ativos carregados com sucesso!`);
    } catch (error: any) {
      console.error(error);
      setStatusMessage('Ocorreu um erro ao buscar os dados do IXC.');
      toast.error(error.message || 'Erro ao carregar dados do IXC. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (activeClients.length === 0) {
      toast.error('Nenhum dado disponível para download.');
      return;
    }

    try {
      // 1. Filtrar e mapear apenas as colunas selecionadas
      const headers = AVAILABLE_COLUMNS
        .filter(col => selectedColumns.includes(col.key as string))
        .map(col => col.label);

      const rows = activeClients.map(client => {
        return AVAILABLE_COLUMNS
          .filter(col => selectedColumns.includes(col.key as string))
          .map(col => {
            const rawValue = getClientValue(client, col.key as string);
            
            // Tratamento de aspas e quebras de linha para evitar quebras no CSV
            const cleanStr = rawValue
              .replace(/"/g, '""')
              .replace(/\r?\n|\r/g, ' ');
            
            // Colocar entre aspas se contiver o delimitador selecionado
            return cleanStr.includes(delimiter) ? `"${cleanStr}"` : cleanStr;
          });
      });

      // 2. Montar conteúdo
      const csvContent = [
        headers.join(delimiter),
        ...rows.map(row => row.join(delimiter))
      ].join('\n');

      // 3. UTF-8 BOM (\uFEFF) para garantir acentos corretos no Excel
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `clientes_ativos_ixc_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Planilha gerada e baixada com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar a planilha.');
    }
  };

  return (
    <PageTransition>
      <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Database className="w-4 h-4" />
            <span>Sistema IXC</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Exportador de Clientes Ativos</span>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-200">
                  <FileSpreadsheet className="w-7 h-7 text-white" />
                </div>
                Exportar Clientes Ativos
              </h1>
              <p className="text-gray-500 mt-2 font-medium">
                Busca recursiva na base IXC para extrair e gerar planilha de cadastros ativos.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Seletor de Colunas */}
          <Card className="lg:col-span-2 bg-white border-none shadow-sm flex flex-col justify-between">
            <CardHeader className="border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-sky-500" />
                    Colunas do Cadastro
                  </CardTitle>
                  <CardDescription className="text-gray-500 text-xs">
                    Selecione quais dados cadastrais deseja incluir no relatório final.
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSelectAll}
                  className="text-xs h-8 font-semibold border-gray-200 hover:border-sky-500"
                >
                  {selectedColumns.length === AVAILABLE_COLUMNS.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {AVAILABLE_COLUMNS.map(col => {
                  const isChecked = selectedColumns.includes(col.key as string);
                  return (
                    <div 
                      key={col.key}
                      onClick={() => handleToggleColumn(col.key as string)}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked 
                          ? 'border-sky-200 bg-sky-50/50 shadow-sm' 
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      <Checkbox 
                        id={`col-${col.key}`} 
                        checked={isChecked}
                        onCheckedChange={() => {}} // Tratado no clique do container
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <Label 
                          htmlFor={`col-${col.key}`} 
                          className="font-bold text-sm text-gray-800 cursor-pointer"
                        >
                          {col.label}
                        </Label>
                        <p className="text-xs text-gray-500 leading-normal">{col.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Configurações de Download e Progresso */}
          <Card className="lg:col-span-1 bg-white border-none shadow-sm flex flex-col justify-between">
            <CardHeader className="border-b border-gray-100 pb-4">
              <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
                <ListFilter className="w-5 h-5 text-sky-500" />
                Configuração de Saída
              </CardTitle>
              <CardDescription className="text-gray-500 text-xs">
                Defina o formato de salvamento da planilha.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex-1 space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Delimitador do CSV
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant={delimiter === ';' ? 'default' : 'outline'}
                    className={`flex-1 font-bold ${delimiter === ';' ? 'bg-sky-600 hover:bg-sky-700' : ''}`}
                    onClick={() => setDelimiter(';')}
                  >
                    Ponto e vírgula (;)
                  </Button>
                  <Button
                    variant={delimiter === ',' ? 'default' : 'outline'}
                    className={`flex-1 font-bold ${delimiter === ',' ? 'bg-sky-600 hover:bg-sky-700' : ''}`}
                    onClick={() => setDelimiter(',')}
                  >
                    Vírgula (,)
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400 italic">
                  * Ponto e vírgula (;) é recomendado para abrir diretamente no Microsoft Excel brasileiro.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 space-y-4">
                <Button 
                  className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold h-12 rounded-xl shadow-md shadow-sky-100 gap-2 transition-all active:scale-[0.98]"
                  onClick={handleFetchActiveClients}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Carregando Dados...
                    </>
                  ) : (
                    <>
                      <Database className="w-5 h-5" />
                      Iniciar Importação IXC
                    </>
                  )}
                </Button>

                {activeClients.length > 0 && !loading && (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl shadow-md shadow-emerald-100 gap-2 transition-all active:scale-[0.98]"
                    onClick={handleDownloadCSV}
                  >
                    <Download className="w-5 h-5" />
                    Baixar Planilha ({activeClients.length})
                  </Button>
                )}
              </div>

              {/* Status e Progresso */}
              {(loading || progress > 0) && (
                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-gray-600">Status da Coleta</span>
                    <span className="text-sky-600 font-bold">{loadedCount} registros</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-gray-100 text-sky-500" />
                  <p className="text-[11px] font-medium text-gray-500 flex items-center gap-1.5">
                    {loading && <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin" />}
                    {statusMessage}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pré-visualização da Tabela */}
        <AnimatePresence>
          {activeClients.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <Card className="bg-white border-none shadow-sm overflow-hidden">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-sky-500" />
                        Pré-visualização dos Clientes Ativos
                      </CardTitle>
                      <CardDescription className="text-gray-500 text-xs">
                        Mostrando uma amostra das primeiras 10 linhas que serão exportadas.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          {AVAILABLE_COLUMNS
                            .filter(col => selectedColumns.includes(col.key as string))
                            .map(col => (
                              <TableHead key={col.key} className="text-gray-700 font-bold uppercase text-xs">
                                {col.label}
                              </TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeClients.slice(0, 10).map((client, i) => (
                          <TableRow key={i} className="hover:bg-gray-50/50 transition-colors">
                            {AVAILABLE_COLUMNS
                              .filter(col => selectedColumns.includes(col.key as string))
                              .map(col => (
                                <TableCell key={col.key} className="text-gray-700 text-sm max-w-xs truncate">
                                  {getClientValue(client, col.key as string) || '-'}
                                </TableCell>
                              ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alertas informativos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Alert className="bg-white border-none shadow-sm">
            <Info className="h-4 w-4 text-sky-500" />
            <AlertTitle className="text-gray-800 font-bold text-sm">Controle de Progresso</AlertTitle>
            <AlertDescription className="text-xs text-gray-500 leading-relaxed mt-1">
              A API do IXC Soft retorna registros paginados de 1.000 em 1.000. O sistema acumulará recursivamente 
              todos os clientes ativos e atualizará o progresso em lotes.
            </AlertDescription>
          </Alert>
          <Alert className="bg-white border-none shadow-sm">
            <HelpCircle className="h-4 w-4 text-sky-500" />
            <AlertTitle className="text-gray-800 font-bold text-sm">Codificação UTF-8</AlertTitle>
            <AlertDescription className="text-xs text-gray-500 leading-relaxed mt-1">
              Exportamos a planilha com o marcador UTF-8 BOM, garantindo compatibilidade direta com acentuações no Excel 
              sem necessitar de assistente de importação manual.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </PageTransition>
  );
}
