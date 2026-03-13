import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Download,
  Database,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ixcService } from '@/services/ixc/ixcService';
import { 
  IXCSearchState, 
  IXCSearchType,
  IXCClienteData 
} from '@/types/ixc';
import { TechnicalDiagnostics } from '@/components/ixc/TechnicalDiagnostics';
import { ClientContracts } from '@/components/ixc/ClientContracts';
import { NewTicketForm } from '@/components/ixc/NewTicketForm';
import { ClientTickets } from '@/components/ixc/ClientTickets';

const IXCConsulta: React.FC = () => {
  const [searchState, setSearchState] = useState<IXCSearchState>({
    loading: false,
    error: null,
    results: [],
    searchType: 'cnpj_cpf',
    searchValue: '',
    totalResults: 0,
    currentPage: 1,
  });

  const [selectedClient, setSelectedClient] = useState<IXCClienteData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'disconnected' | null>(null);
  const navigate = useNavigate();

  // Testar conexão com a API
  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      const isConnected = await ixcService.testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  // Executar busca
  const handleSearch = async () => {
    if (!searchState.searchValue.trim()) {
      setSearchState(prev => ({ ...prev, error: 'Por favor, insira um valor para buscar' }));
      return;
    }

    setSearchState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let results: IXCClienteData[] = [];

      switch (searchState.searchType) {
        case 'cnpj_cpf': {
          const cliente = await ixcService.getClienteByCnpjCpf(searchState.searchValue);
          results = cliente ? [cliente] : [];
          break;
        }
        case 'nome': {
          results = await ixcService.getClienteByNome(searchState.searchValue);
          break;
        }
        case 'id': {
          const clienteById = await ixcService.getClienteById(searchState.searchValue);
          results = clienteById ? [clienteById] : [];
          break;
        }
        case 'cidade': {
          results = await ixcService.getClientesByCidade(searchState.searchValue);
          break;
        }
        case 'email': {
          const emailResults = await ixcService.searchClientes(
            'cliente.email',
            searchState.searchValue,
            'LIKE'
          );
          results = emailResults.registros as IXCClienteData[];
          break;
        }
        case 'whatsapp': {
          const whatsappResults = await ixcService.searchClientes(
            'cliente.fone_whatsapp',
            searchState.searchValue,
            'LIKE'
          );
          results = whatsappResults.registros as IXCClienteData[];
          break;
        }
        default:
          results = [];
      }

      setSearchState(prev => ({
        ...prev,
        loading: false,
        results,
        totalResults: results.length,
        error: results.length === 0 ? 'Nenhum cliente encontrado com os critérios especificados' : null,
      }));

      if (results.length > 0) {
        setSelectedClient(results[0]);
      }
    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao buscar cliente',
      }));
    }
  };

  // Buscar clientes ativos
  const handleGetClientesAtivos = async () => {
    setSearchState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const results = await ixcService.getClientesAtivos();
      setSearchState(prev => ({
        ...prev,
        loading: false,
        results,
        totalResults: results.length,
        searchType: 'ativo',
        searchValue: 'Todos os clientes ativos',
      }));
    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao buscar clientes ativos',
      }));
    }
  };

  // Buscar leads
  const handleGetLeads = async () => {
    setSearchState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const results = await ixcService.getLeads();
      setSearchState(prev => ({
        ...prev,
        loading: false,
        results,
        totalResults: results.length,
        searchType: 'lead',
        searchValue: 'Todos os leads',
      }));
    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao buscar leads',
      }));
    }
  };

  // Formatar telefone
  const formatPhone = (phone: string | undefined): string => {
    if (!phone) return 'Não informado';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Formatar CNPJ/CPF
  const formatCnpjCpf = (cnpjCpf: string | undefined): string => {
    if (!cnpjCpf) return 'Não informado';
    const cleaned = cnpjCpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cnpjCpf;
  };

  // Copiar para clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Aqui poderia adicionar uma notificação de sucesso
      console.log(`${label} copiado para a área de transferência`);
    });
  };

  React.useEffect(() => {
    testConnection();
  }, []);

  return (
    <PageTransition>
      <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Database className="w-4 h-4" />
            <span>Sistema IXC</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Consulta de Clientes</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                Consulta IXC
              </h1>
              <p className="text-gray-600 mt-2">
                Busque informações de clientes na base de dados IXC
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div 
                  className={`w-3 h-3 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' :
                    connectionStatus === 'disconnected' ? 'bg-red-500' :
                    connectionStatus === 'testing' ? 'bg-yellow-500 animate-pulse' :
                    'bg-gray-400'
                  }`}
                />
                <span className="text-sm text-gray-600">
                  {connectionStatus === 'connected' && 'Conectado'}
                  {connectionStatus === 'disconnected' && 'Desconectado'}
                  {connectionStatus === 'testing' && 'Testando...'}
                  {!connectionStatus && 'Não testado'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card de Busca */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Buscar Cliente
            </CardTitle>
            <CardDescription>
              Escolha o tipo de busca e insira o valor desejado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search-type">Tipo de Busca</Label>
                <Select
                  value={searchState.searchType}
                  onValueChange={(value: IXCSearchType) =>
                    setSearchState(prev => ({ ...prev, searchType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cnpj_cpf">CNPJ/CPF</SelectItem>
                    <SelectItem value="nome">Nome</SelectItem>
                    <SelectItem value="id">ID</SelectItem>
                    <SelectItem value="cidade">Cidade</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="search-value">Valor</Label>
                <Input
                  id="search-value"
                  value={searchState.searchValue}
                  onChange={(e) =>
                    setSearchState(prev => ({ ...prev, searchValue: e.target.value }))
                  }
                  placeholder={`Digite o ${searchState.searchType}...`}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button 
                  onClick={handleSearch} 
                  disabled={searchState.loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {searchState.loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  <span>Buscar</span>
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleGetClientesAtivos}
                disabled={searchState.loading}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Clientes Ativos
              </Button>
              <Button
                variant="outline"
                onClick={handleGetLeads}
                disabled={searchState.loading}
              >
                <User className="w-4 h-4 mr-2" />
                Leads
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Alertas de Erro */}
        <AnimatePresence>
          {searchState.error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {searchState.error}
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resultados da Busca */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista de Resultados */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Resultados ({searchState.totalResults})
                </span>
                {searchState.loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {searchState.loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : searchState.results.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchState.results.map((cliente, index) => (
                    <motion.div
                      key={cliente.id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedClient?.id === cliente.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedClient(cliente)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {cliente.nome || cliente.razao || 'Nome não informado'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {cliente.cnpj_cpf ? formatCnpjCpf(cliente.cnpj_cpf) : 'CPF/CNPJ não informado'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {cliente.ativo === 'S' && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Ativo
                            </Badge>
                          )}
                          {cliente.lead === 'S' && (
                            <Badge variant="secondary">Lead</Badge>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum resultado encontrado</p>
                  <p className="text-sm">Tente ajustar os critérios de busca</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detalhes do Cliente Selecionado */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Detalhes do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedClient ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600">Nome</Label>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900">{selectedClient.nome || selectedClient.razao || 'Não informado'}</p>
                        {(selectedClient.nome || selectedClient.razao) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedClient.nome || selectedClient.razao || '', 'Nome')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600">Tipo de Pessoa</Label>
                      <p className="text-gray-900">
                        {selectedClient.tipo_pessoa === 'F' ? 'Física' : 
                         selectedClient.tipo_pessoa === 'J' ? 'Jurídica' : 'Não informado'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600">CNPJ/CPF</Label>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900">{formatCnpjCpf(selectedClient.cnpj_cpf)}</p>
                        {selectedClient.cnpj_cpf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedClient.cnpj_cpf || '', 'CNPJ/CPF')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600">Status</Label>
                      <div className="flex items-center gap-2">
                        {selectedClient.ativo === 'S' ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inativo
                          </Badge>
                        )}
                        {selectedClient.lead === 'S' && (
                          <Badge variant="outline">Lead</Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        Telefone
                      </Label>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900">{formatPhone(selectedClient.fone_celular)}</p>
                        {selectedClient.fone_celular && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedClient.fone_celular || '', 'Telefone')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        WhatsApp
                      </Label>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900">{formatPhone(selectedClient.fone_whatsapp)}</p>
                        {selectedClient.fone_whatsapp && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedClient.fone_whatsapp || '', 'WhatsApp')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Email
                      </Label>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900">{selectedClient.email || 'Não informado'}</p>
                        {selectedClient.email && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedClient.email || '', 'Email')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Cidade
                      </Label>
                      <p className="text-gray-900">{selectedClient.cidade || 'Não informado'}</p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Endereço
                      </Label>
                      <p className="text-gray-900">
                        {selectedClient.endereco ? `${selectedClient.endereco}, ${selectedClient.bairro || ''}` : 'Não informado'}
                      </p>
                    </div>

                    {selectedClient.obs && (
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm font-medium text-gray-600">Observações</Label>
                        <p className="text-gray-900">{selectedClient.obs}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button 
                      className="bg-primary hover:bg-primary/90" 
                      onClick={() => navigate(`/ixc/cliente/${selectedClient.id}`)}
                    >
                      <Database className="w-4 h-4 mr-2" />
                      Abrir Dashboard
                    </Button>
                    <Button variant="outline" size="sm" className="hidden md:flex">
                      <ExternalLink className="w-3 h-3 mr-2" />
                      Abrir no IXC
                    </Button>
                    <NewTicketForm idCliente={selectedClient.id || ''} />
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Selecione um cliente para ver os detalhes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Contratos e Diagnóstico */}
        {selectedClient && selectedClient.id && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Contratos */}
            <div>
               <ClientContracts idCliente={selectedClient.id} />
            </div>

            {/* Diagnóstico Técnico */}
            <div>
              <TechnicalDiagnostics idCliente={selectedClient.id} />
            </div>

            {/* Histórico de Chamados */}
            <div className="lg:col-span-2">
              <ClientTickets idCliente={selectedClient.id} />
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
};

export default IXCConsulta;