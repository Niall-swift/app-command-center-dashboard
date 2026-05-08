import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Download, Loader2, FileSpreadsheet, Info, Eye, Table as TableIcon, RefreshCw } from 'lucide-react';
import ixcService from '@/services/ixc/ixcService';
import { IXCClienteData, IXCContratoData, IXCPlanoData } from '@/types/ixc';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiciRow {
  cnpj: string;
  ano: string;
  mes: string;
  cod_ibge: string;
  tipo_cliente: string;
  tipo_atendimento: string;
  tipo_meio: string;
  tipo_produto: string;
  tipo_tecnologia: string;
  velocidade: string;
  acessos: string;
}

export default function IXCDici() {
  const [cnpj, setCnpj] = useState('45517137000156');
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [mes, setMes] = useState(
    (new Date().getMonth() === 0 ? 12 : new Date().getMonth()).toString()
  );
  const [codIbge, setCodIbge] = useState('3303500');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [previewData, setPreviewData] = useState<DiciRow[]>([]);
  const { toast } = useToast();

  const handleGenerate = async (download = true) => {
    try {
      setLoading(true);
      setPreviewData([]);
      
      // 1. Buscar Planos
      setProgress('Buscando planos...');
      const planos = await ixcService.getAllVdPlanos((total) => {
        setProgress(`Buscando planos... (${total})`);
      });
      const planosMap = new Map<string, IXCPlanoData>();
      planos.forEach(p => {
        if (p.id) planosMap.set(String(p.id), p);
      });
      console.log('📦 Planos carregados:', planos.length);
      if (planos.length > 0) console.log('Exemplo plano:', planos[0]);

      // 2. Buscar Clientes (Tentar todos se os ativos forem poucos)
      setProgress('Buscando clientes...');
      let clientes = await ixcService.fetchAllClientesAtivos((total) => {
        setProgress(`Buscando clientes ativos... (${total})`);
      });
      
      if (clientes.length === 0) {
        setProgress('Nenhum cliente ativo? Buscando todos os clientes...');
        clientes = await ixcService.getAllClientes(1, 1000).then(r => r.registros || []);
      }
      
      console.log('👥 Clientes carregados:', clientes.length);
      
      const clientesMap = new Map<string, IXCClienteData>();
      clientes.forEach(c => {
        if (c.id) clientesMap.set(String(c.id), c);
      });

      // 3. Buscar Contratos Ativos
      setProgress('Buscando contratos ativos...');
      const contratos = await ixcService.fetchAllContratosAtivos((total) => {
        setProgress(`Buscando contratos ativos... (${total})`);
      });

      console.log('📊 Contratos ativos encontrados:', contratos.length);
      
      if (contratos.length === 0) {
        throw new Error('Nenhum contrato ativo foi encontrado no IXC.');
      }

      // 4. Processar Dados
      setProgress('Processando dados para DICI...');
      
      const stats = new Map<string, Map<number, number>>();
      stats.set('PF', new Map<number, number>());
      stats.set('PJ', new Map<number, number>());

      let processedCount = 0;
      let missingClientCount = 0;
      let missingSpeedCount = 0;
      const failedSamples: any[] = [];

      contratos.forEach(contrato => {
        const clienteId = contrato.id_cliente;
        const cliente = clientesMap.get(String(clienteId));
        
        if (!cliente) {
          missingClientCount++;
          return;
        }

        // Regra de tipo de pessoa: J = PJ, F = PF
        const tipoPessoa = (cliente.tipo_pessoa === 'J' || String(cliente.cnpj_cpf).replace(/\D/g, '').length > 11) ? 'PJ' : 'PF';
        
        // Tentar buscar velocidade
        let velRaw = contrato.velocidade_download || (contrato as any).download || "";
        const planoId = contrato.id_plano || (contrato as any).id_vd_plano;
        const plano = planosMap.get(String(planoId));
        
        if (!velRaw && plano) {
          velRaw = plano.velocidade_download || (plano as any).download || "";
        }

        // Se ainda não tiver, tentar pegar do campo 'plano' ou 'descricao'
        if (!velRaw) {
          const desc = String(contrato.plano || contrato.descricao || plano?.descricao || "").toLowerCase();
          // Regex melhorado: busca número seguido de M, K, G, Mega, Meg, etc.
          const matchDesc = desc.match(/(\d+)\s*(m|k|g|mega|meg|kb|mb|gb)/i);
          if (matchDesc) {
             let val = parseInt(matchDesc[1]);
             const unit = matchDesc[2].toLowerCase();
             if (unit.startsWith('g')) val *= 1000;
             if (unit.startsWith('k')) val /= 1000;
             velRaw = val.toString();
          }
        }

        // Extrair apenas números finais
        const match = String(velRaw).match(/(\d+)/);
        const velocidade = match ? parseInt(match[1]) : 0;

        if (velocidade > 0) {
          const tipoStats = stats.get(tipoPessoa)!;
          tipoStats.set(velocidade, (tipoStats.get(velocidade) || 0) + 1);
          processedCount++;
        } else {
          missingSpeedCount++;
          if (failedSamples.length < 5) failedSamples.push({ contrato, plano });
        }
      });

      if (failedSamples.length > 0) {
        console.warn('⚠️ Amostras de contratos sem velocidade identificada:', failedSamples);
      }

      console.log(`✅ Resultado: Processados ${processedCount}, Sem Cliente: ${missingClientCount}, Sem Vel: ${missingSpeedCount}`);

      // 5. Gerar Linhas para Preview e CSV
      const diciRows: DiciRow[] = [];
      const cleanCnpj = cnpj.replace(/\D/g, '');

      ['PJ', 'PF'].forEach(tipo => {
        const tipoStats = stats.get(tipo)!;
        const speeds = Array.from(tipoStats.keys()).sort((a, b) => a - b);
        
        speeds.forEach(speed => {
          diciRows.push({
            cnpj: cleanCnpj,
            ano: ano,
            mes: mes,
            cod_ibge: codIbge,
            tipo_cliente: tipo,
            tipo_atendimento: 'URBANO',
            tipo_meio: 'fibra',
            tipo_produto: 'internet',
            tipo_tecnologia: 'FTTH',
            velocidade: speed.toString(),
            acessos: tipoStats.get(speed)!.toString()
          });
        });
      });

      setPreviewData(diciRows);

      if (processedCount === 0) {
        toast({
          variant: "destructive",
          title: "Aviso",
          description: `Nenhum dado processado. Contratos: ${contratos.length}, Sem cliente: ${missingClientCount}, Sem velocidade: ${missingSpeedCount}.`,
        });
        setLoading(false);
        return;
      }

      if (download) {
        // Gerar CSV com ponto-e-vírgula (;) para Excel brasileiro
        const header = ['CNPJ', 'ANO', 'MES', 'COD_IBGE', 'TIPO_CLIENTE', 'TIPO_ATENDIMENTO', 'TIPO_MEIO', 'TIPO_PRODUTO', 'TIPO_TECNOLOGIA', 'VELOCIDADE', 'ACESSOS'];
        const csvContent = [
          header.join(';'),
          ...diciRows.map(r => [
            r.cnpj, r.ano, r.mes, r.cod_ibge, r.tipo_cliente, 
            r.tipo_atendimento, r.tipo_meio, r.tipo_produto, 
            r.tipo_tecnologia, r.velocidade, r.acessos
          ].join(';'))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `DICI_${cleanCnpj}_${ano}_${mes}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "Download Concluído",
          description: `Planilha com ${processedCount} acessos distribuídos em ${diciRows.length} faixas.`,
        });
      }

    } catch (error: any) {
      console.error('Erro ao gerar DICI:', error);
      toast({
        variant: "destructive",
        title: "Erro fatal",
        description: error.message || "Falha na comunicação com o IXC.",
      });
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-blue-500" />
          Gerador DICI Anatel
        </h1>
        <p className="text-slate-400">
          Consolidação automática de contratos IXC para coleta de dados regulatórios.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-slate-900/50 border-slate-800 shadow-2xl backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white text-lg">Parâmetros de Coleta</CardTitle>
            <CardDescription className="text-slate-500 text-xs">Informe os dados da licença SCM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="cnpj" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">CNPJ da Prestadora</Label>
              <Input 
                id="cnpj" 
                value={cnpj} 
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="45517137000156"
                className="bg-slate-950 border-slate-800 text-white h-11 focus:ring-blue-500/50"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ano" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Ano Base</Label>
                <Input 
                  id="ano" 
                  value={ano} 
                  onChange={(e) => setAno(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mes" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Mês de Ref.</Label>
                <Input 
                  id="mes" 
                  value={mes} 
                  onChange={(e) => setMes(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white h-11"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ibge" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Município (Cód. IBGE)</Label>
              <Input 
                id="ibge" 
                value={codIbge} 
                onChange={(e) => setCodIbge(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white h-11"
              />
              <p className="text-[10px] text-slate-500 px-1 italic">Ex: 3303500 (Itaboraí), 3305109 (São Gonçalo)</p>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button 
                variant="outline"
                className="border-slate-800 hover:bg-slate-800 text-slate-300 h-12"
                onClick={() => handleGenerate(false)} 
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                Pré-visualizar
              </Button>
              
              <Button 
                variant="ghost"
                className="text-[10px] text-slate-600 hover:text-slate-400"
                onClick={async () => {
                  const contracts = await ixcService.fetchAllContratosAtivos();
                  console.log('🔍 DEBUG CONTRATO (Campos disponíveis):', contracts[0]);
                  toast({ title: "Check Console", description: "Campos do contrato logados." });
                }}
              >
                Inspecionar Campos (Debug)
              </Button>

              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white h-12 font-bold shadow-lg shadow-blue-900/20" 
                onClick={() => handleGenerate(true)} 
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Exportar CSV Final
              </Button>
            </div>
            
            {progress && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <RefreshCw className="h-3 w-3 text-blue-400 animate-spin" />
                <p className="text-[10px] text-blue-400 font-medium">{progress}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800 overflow-hidden shadow-2xl backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-4">
            <div>
              <CardTitle className="text-white text-lg">Consolidação de Acessos</CardTitle>
              <CardDescription className="text-slate-500 text-xs">Resumo por Velocidade e Categoria.</CardDescription>
            </div>
            <TableIcon className="h-5 w-5 text-slate-700" />
          </CardHeader>
          <CardContent className="p-0">
            {previewData.length > 0 ? (
              <ScrollArea className="h-[480px]">
                <Table>
                  <TableHeader className="bg-slate-950/50 sticky top-0 z-10 backdrop-blur-md">
                    <TableRow className="border-slate-800/50 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs font-bold uppercase py-4">Categoria</TableHead>
                      <TableHead className="text-slate-400 text-xs font-bold uppercase py-4">Velocidade</TableHead>
                      <TableHead className="text-slate-400 text-xs font-bold uppercase py-4">Meio / Tecnologia</TableHead>
                      <TableHead className="text-slate-400 text-xs font-bold uppercase py-4 text-right">Qtd. Acessos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i} className="border-slate-800/30 hover:bg-slate-800/40 transition-colors">
                        <TableCell className="font-bold text-slate-200">
                          <span className={row.tipo_cliente === 'PJ' ? 'text-purple-400' : 'text-blue-400'}>
                            {row.tipo_cliente}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-300 font-medium">{row.velocidade} Mbps</TableCell>
                        <TableCell className="text-slate-500 text-xs">{row.tipo_meio} | {row.tipo_tecnologia}</TableCell>
                        <TableCell className="text-right">
                          <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-sm font-black border border-blue-500/20">
                            {row.acessos}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="h-[480px] flex flex-col items-center justify-center text-slate-600 bg-slate-950/20">
                <div className="relative mb-6">
                  <FileSpreadsheet className="h-20 w-20 opacity-5" />
                  <Loader2 className={`h-6 w-6 absolute inset-0 m-auto text-blue-500 ${loading ? 'animate-spin' : 'hidden'}`} />
                </div>
                <p className="text-sm font-medium">Nenhum dado processado para visualização</p>
                <p className="text-[10px] mt-1 opacity-50 uppercase tracking-tighter">Inicie a coleta nos parâmetros ao lado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <Alert className="bg-slate-900 border-slate-800">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertTitle className="text-slate-200 text-xs">Nota sobre Velocidades</AlertTitle>
            <AlertDescription className="text-[10px] text-slate-500">
              O sistema busca a velocidade no Contrato e, se ausente, recorre ao Plano associado no IXC. 
              Planos sem velocidade numérica explícita no nome ou campo serão ignorados na contagem.
            </AlertDescription>
         </Alert>
         <Alert className="bg-slate-900 border-slate-800">
            <Info className="h-4 w-4 text-purple-400" />
            <AlertTitle className="text-slate-200 text-xs">Separação de Clientes</AlertTitle>
            <AlertDescription className="text-[10px] text-slate-500">
              Pessoas Jurídicas (PJ) são identificadas pelo tipo 'J' ou CNPJ com mais de 11 dígitos. 
              Pessoas Físicas (PF) são identificadas pelo tipo 'F' ou CPF com até 11 dígitos.
            </AlertDescription>
         </Alert>
      </div>
    </div>
  );
}
