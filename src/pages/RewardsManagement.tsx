import React, { useState, useEffect } from 'react';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Power, Gift, Search, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { rewardsAdminService } from '@/services/rewardsAdminService';
import { Reward } from '@/types/rewards';

export default function RewardsManagement() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentReward, setCurrentReward] = useState<Partial<Reward>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Carregar recompensas
  const fetchRewards = async () => {
    setLoading(true);
    try {
      const data = await rewardsAdminService.getAllRewards();
      setRewards(data);
    } catch (error) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as recompensas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  // Abrir modal para criar
  const handleOpenCreate = () => {
    setCurrentReward({ 
      active: true, 
      type: 'discount',
      pointsCost: 100,
      value: 0
    });
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (reward: Reward) => {
    setCurrentReward({ ...reward });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // Salvar (criar ou atualizar)
  const handleSave = async () => {
    try {
      if (!currentReward.name || !currentReward.pointsCost) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha nome e custo em pontos.',
          variant: 'destructive',
        });
        return;
      }

      const rewardData: Record<string, any> = {
        name: currentReward.name,
        description: currentReward.description || '',
        icon: currentReward.icon || '🎁',
        pointsCost: Number(currentReward.pointsCost),
        type: currentReward.type,
        value: Number(currentReward.value),
        active: currentReward.active ?? true,
      };

      if (currentReward.stock !== undefined && currentReward.stock !== null) {
        rewardData.stock = Number(currentReward.stock);
      }

      if (currentReward.imageUrl) {
        rewardData.imageUrl = currentReward.imageUrl;
      }

      if (isEditing && currentReward.id) {
        await rewardsAdminService.updateReward(currentReward.id, rewardData);
        toast({ title: 'Recompensa atualizada!' });
      } else {
        await rewardsAdminService.createReward(rewardData as any);
        toast({ title: 'Recompensa criada!' });
      }

      setIsDialogOpen(false);
      fetchRewards();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao salvar a recompensa.',
        variant: 'destructive',
      });
    }
  };

  // Alternar status
  const handleToggleStatus = async (reward: Reward) => {
    try {
      await rewardsAdminService.toggleStatus(reward.id, reward.active);
      fetchRewards();
      toast({
        title: reward.active ? 'Recompensa desativada' : 'Recompensa ativada',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status.',
        variant: 'destructive',
      });
    }
  };

  // Filtrar recompensas
  const filteredRewards = rewards.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Recompensas</h1>
            <p className="text-gray-600">Adicione e gerencie os itens da loja de pontos</p>
          </div>
          <Button onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Nova Recompensa
          </Button>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar recompensa..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de Recompensas */}
        {loading ? (
          <div className="flex justify-center py-10">Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRewards.map((reward) => (
              <Card key={reward.id} className={`overflow-hidden transition-all hover:shadow-md ${!reward.active ? 'opacity-70 bg-gray-50' : ''}`}>
                <div className={`h-2 w-full ${
                  reward.type === 'discount' ? 'bg-pink-500' :
                  reward.type === 'upgrade' ? 'bg-blue-500' :
                  reward.type === 'premium' ? 'bg-yellow-500' :
                  reward.type === 'product' ? 'bg-green-600' :
                  'bg-indigo-500'
                }`} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-gray-100 w-12 h-12 flex items-center justify-center rounded-full overflow-hidden">
                        {reward.imageUrl ? (
                          <img src={reward.imageUrl} alt={reward.name} className="w-full h-full object-cover" />
                        ) : (
                          reward.icon
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{reward.name}</CardTitle>
                        <CardDescription>{reward.pointsCost} pontos</CardDescription>
                      </div>
                    </div>
                    <Badge variant={reward.active ? "default" : "secondary"}>
                      {reward.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
                    {reward.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      <span>Estoque: {reward.stock !== undefined ? reward.stock : '∞'}</span>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {reward.type === 'discount' ? 'Desconto' :
                       reward.type === 'upgrade' ? 'Upgrade' :
                       reward.type === 'premium' ? 'Premium' : 
                       reward.type === 'product' ? 'Produto' : 'Crédito'}
                    </Badge>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenEdit(reward)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={`flex-1 ${reward.active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}
                      onClick={() => handleToggleStatus(reward)}
                    >
                      <Power className="w-4 h-4 mr-2" />
                      {reward.active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Criar/Editar */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Editar Recompensa' : 'Nova Recompensa'}</DialogTitle>
              <DialogDescription>
                Preencha os detalhes da recompensa abaixo.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nome</Label>
                <Input
                  id="name"
                  value={currentReward.name || ''}
                  onChange={(e) => setCurrentReward({ ...currentReward, name: e.target.value })}
                  className="col-span-3"
                  placeholder="Ex: Desconto 10%"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="desc" className="text-right">Descrição</Label>
                <Input
                  id="desc"
                  value={currentReward.description || ''}
                  onChange={(e) => setCurrentReward({ ...currentReward, description: e.target.value })}
                  className="col-span-3"
                  placeholder="Breve descrição..."
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cost" className="text-right">Custo (Pts)</Label>
                <Input
                  id="cost"
                  type="number"
                  value={currentReward.pointsCost || ''}
                  onChange={(e) => setCurrentReward({ ...currentReward, pointsCost: Number(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Tipo</Label>
                <Select 
                  value={currentReward.type} 
                  onValueChange={(val) => setCurrentReward({ ...currentReward, type: val as any })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="discount">Desconto</SelectItem>
                      <SelectItem value="upgrade">Upgrade</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="credit">Crédito</SelectItem>
                      <SelectItem value="product">Produto Físico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="icon" className="text-right">Ícone</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    id="icon"
                    value={currentReward.icon || ''}
                    onChange={(e) => setCurrentReward({ ...currentReward, icon: e.target.value })}
                    className="flex-1"
                    placeholder="Emoji (🎁)"
                  />
                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xl">
                    {currentReward.icon || '🎁'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="imageUrl" className="text-right">URL Imagem</Label>
                <Input
                  id="imageUrl"
                  value={currentReward.imageUrl || ''}
                  onChange={(e) => setCurrentReward({ ...currentReward, imageUrl: e.target.value })}
                  className="col-span-3"
                  placeholder="https://... (Opcional)"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stock" className="text-right">Estoque</Label>
                <Input
                  id="stock"
                  type="number"
                  value={currentReward.stock || ''}
                  onChange={(e) => setCurrentReward({ ...currentReward, stock: e.target.value ? Number(e.target.value) : undefined })}
                  className="col-span-3"
                  placeholder="Deixe vazio para ilimitado"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="value" className="text-right">Valor Real</Label>
                <Input
                  id="value"
                  type="number"
                  value={currentReward.value || ''}
                  onChange={(e) => setCurrentReward({ ...currentReward, value: Number(e.target.value) })}
                  className="col-span-3"
                  placeholder="Valor monetário estimado"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="active" className="text-right">Ativo</Label>
                <div className="col-span-3 flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={currentReward.active}
                    onCheckedChange={(checked) => setCurrentReward({ ...currentReward, active: checked })}
                  />
                  <Label htmlFor="active">{currentReward.active ? 'Sim' : 'Não'}</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
