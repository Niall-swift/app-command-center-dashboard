import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Slash,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  normalizeSlashCommand,
  type SlashMacro,
} from '@/services/chatSlashMacrosService';

interface SlashMacrosManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  macros: SlashMacro[];
  saving: boolean;
  initialCmd?: string;
  onSaveMacro: (input: { id?: string; cmd: string; label: string; text: string }) => Promise<void>;
  onDeleteMacro: (id: string) => Promise<void>;
  onRestoreDefaults: () => Promise<number>;
  onInsertMacro?: (macro: SlashMacro) => void;
}

const SlashMacrosManagerDialogComponent: React.FC<SlashMacrosManagerDialogProps> = ({
  open,
  onOpenChange,
  macros,
  saving,
  initialCmd,
  onSaveMacro,
  onDeleteMacro,
  onRestoreDefaults,
  onInsertMacro,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cmdInput, setCmdInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [formExpanded, setFormExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearchFilter('');
    if (initialCmd && initialCmd.trim()) {
      setEditingId(null);
      setCmdInput(normalizeSlashCommand(initialCmd) || '/');
      setLabelInput('');
      setTextInput('');
      setFormExpanded(true);
    } else {
      setEditingId(null);
      setCmdInput('');
      setLabelInput('');
      setTextInput('');
      setFormExpanded(false);
    }
  }, [open, initialCmd]);

  const filteredMacros = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return macros;
    return macros.filter(
      (m) =>
        m.cmd.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        m.text.toLowerCase().includes(q)
    );
  }, [macros, searchFilter]);

  const normalizedPreviewCmd = normalizeSlashCommand(cmdInput);

  const resetForm = () => {
    setEditingId(null);
    setCmdInput('');
    setLabelInput('');
    setTextInput('');
    setFormExpanded(false);
  };

  const handleStartEdit = (macro: SlashMacro) => {
    setEditingId(macro.id);
    setCmdInput(macro.cmd);
    setLabelInput(macro.label);
    setTextInput(macro.text);
    setFormExpanded(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSaveMacro({
        id: editingId || undefined,
        cmd: cmdInput,
        label: labelInput,
        text: textInput,
      });
      toast.success(
        editingId
          ? `Atalho ${normalizedPreviewCmd} atualizado!`
          : `Atalho ${normalizedPreviewCmd} cadastrado!`
      );
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar mensagem rápida.');
    }
  };

  const handleDelete = async (macro: SlashMacro) => {
    try {
      await onDeleteMacro(macro.id);
      if (editingId === macro.id) resetForm();
      toast.success(`Atalho ${macro.cmd} removido.`);
    } catch {
      toast.error('Erro ao excluir atalho.');
    }
  };

  const handleRestoreDefaults = async () => {
    try {
      const added = await onRestoreDefaults();
      if (added > 0) {
        toast.success(`${added} atalho(s) padrão restaurado(s)!`);
      } else {
        toast.info('Todos os atalhos padrão já estão na lista.');
      }
    } catch {
      toast.error('Erro ao restaurar atalhos padrão.');
    }
  };

  const insertVariable = (token: string) => {
    setTextInput((prev) => (prev ? `${prev} ${token}` : token));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/70">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Slash className="w-4 h-4" />
                </span>
                Mensagens Rápidas (Atalho /)
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Cadastre, edite ou remova respostas acionadas ao digitar <code className="font-mono font-bold text-primary">/</code> no chat. Sincronizado para toda a equipe.
              </DialogDescription>
            </div>
            {!formExpanded && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  setCmdInput('/');
                  setLabelInput('');
                  setTextInput('');
                  setFormExpanded(true);
                }}
                className="h-8 gap-1.5 text-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Formulário de Criação / Edição */}
          {formExpanded && (
            <form
              onSubmit={handleSubmit}
              className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  {editingId ? 'Editar mensagem rápida' : 'Cadastrar nova mensagem rápida'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md"
                  onClick={resetForm}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Comando / Atalho *
                  </label>
                  <Input
                    value={cmdInput}
                    onChange={(e) => setCmdInput(e.target.value)}
                    placeholder="Ex.: /boasvindas"
                    className="h-8 text-xs font-mono bg-background"
                    autoFocus
                    required
                  />
                  {cmdInput.trim() && (
                    <p className="text-[10px] text-muted-foreground">
                      Será acionado com:{' '}
                      <span className="font-mono font-bold text-primary">
                        {normalizedPreviewCmd || 'inválido'}
                      </span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Título curto *
                  </label>
                  <Input
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder="Ex.: Boas-vindas ao suporte"
                    className="h-8 text-xs bg-background"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Texto da mensagem *
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertVariable('{primeiro_nome}')}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-[10px] font-mono text-foreground transition-colors"
                      title="Inserir primeiro nome do cliente automaticamente"
                    >
                      <User className="w-2.5 h-2.5" />
                      {'{primeiro_nome}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{nome}')}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-[10px] font-mono text-foreground transition-colors"
                      title="Inserir nome completo do cliente automaticamente"
                    >
                      {'{nome}'}
                    </button>
                  </div>
                </div>
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Digite o texto completo que será inserido no chat..."
                  rows={3}
                  className="text-xs bg-background resize-y"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={resetForm}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !normalizedPreviewCmd || !textInput.trim()}
                  className="h-8 text-xs gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Atalho'}
                </Button>
              </div>
            </form>
          )}

          {/* Barra de busca + restaurar padrões */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar atalhos cadastrados..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={handleRestoreDefaults}
              className="h-8 text-[11px] gap-1 shrink-0"
              title="Readicionar atalhos padrão que tenham sido removidos"
            >
              <RotateCcw className="w-3 h-3" />
              Padrões
            </Button>
          </div>

          {/* Lista de atalhos cadastrados */}
          <div className="space-y-2">
            {filteredMacros.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                Nenhum atalho encontrado. Clique em <strong>Nova</strong> para cadastrar sua primeira mensagem rápida.
              </div>
            ) : (
              filteredMacros.map((macro) => (
                <div
                  key={macro.id}
                  className="p-3 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="secondary"
                        className="font-mono text-[11px] font-bold text-primary bg-primary/10 border-primary/20 shrink-0"
                      >
                        {macro.cmd}
                      </Badge>
                      <span className="text-xs font-semibold text-foreground truncate">
                        {macro.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onInsertMacro && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => {
                            onInsertMacro(macro);
                            onOpenChange(false);
                          }}
                        >
                          Usar
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleStartEdit(macro)}
                        title="Editar atalho"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={saving}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(macro)}
                        title="Excluir atalho"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {macro.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const SlashMacrosManagerDialog = React.memo(SlashMacrosManagerDialogComponent);
