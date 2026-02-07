import React, { useState, useEffect } from 'react';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Users, UserPlus, Gift } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { referralService } from '@/services/referralService';
import { useToast } from '@/hooks/use-toast';
import { Input } from "@/components/ui/input";

export default function MyReferrals() {
  const { user, userData } = useAuth();
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCode = async () => {
      if (user) {
        setLoading(true);
        try {
          // Tentar obter código existente
          let code = await referralService.getUserReferralCode(user.uid);
          
          // Se não tiver, gerar um novo
          if (!code) {
             code = await referralService.generateReferralCode(user.uid);
          }
          
          setReferralCode(code);
        } catch (error) {
          console.error('Erro ao carregar código de indicação:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchCode();
  }, [user]);

  const copyToClipboard = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      toast({
        title: 'Código copiado!',
        description: 'Agora é só compartilhar com seus amigos.',
      });
    }
  };

  const shareReferral = async () => {
    if (referralCode && navigator.share) {
      try {
        await navigator.share({
          title: 'Ganhe pontos na AVL Telecom',
          text: `Use meu código de indicação ${referralCode} e ganhe pontos ao se cadastrar!`,
          url: window.location.origin
        });
      } catch (error) {
        console.log('Erro ao compartilhar:', error);
      }
    } else {
      copyToClipboard();
    }
  };

  const referralCount = userData?.referrals?.length || 0;
  // Assumindo que 1 indicação = 100 pontos (conforme task.md)
  const pointsEarned = referralCount * 100;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Indique e Ganhe</h1>
          <p className="text-gray-600">Compartilhe seu código e ganhe pontos por cada amigo que se cadastrar!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card Código */}
          <Card className="shadow-lg border-purple-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="text-purple-600" />
                Seu Código de Indicação
              </CardTitle>
              <CardDescription>
                Envie este código para seus amigos. Eles ganham 50 pontos e você ganha 100!
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="animate-pulse h-12 bg-gray-100 rounded"></div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 border rounded-md flex items-center justify-center font-mono text-2xl tracking-widest font-bold text-gray-800 p-4">
                    {referralCode}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={copyToClipboard} variant="outline" size="icon" title="Copiar">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button onClick={shareReferral} className="bg-purple-600 hover:bg-purple-700" size="icon" title="Compartilhar">
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Estatísticas */}
          <Card>
             <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="text-blue-600" />
                Suas Indicações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-blue-600 font-medium mb-1">Amigos Indicados</p>
                  <p className="text-3xl font-bold text-blue-900">{referralCount}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-green-600 font-medium mb-1">Pontos Ganhos</p>
                  <p className="text-3xl font-bold text-green-900">{pointsEarned}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Como Funciona */}
        <div className="bg-white p-8 rounded-xl shadow-sm border mt-8">
          <h2 className="text-xl font-bold mb-6">Como funciona?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4">
                <Share2 className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">1. Compartilhe</h3>
              <p className="text-gray-500 text-sm">
                Envie seu código exclusivo para seus amigos, familiares e contatos.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <UserPlus className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">2. Eles se Cadastram</h3>
              <p className="text-gray-500 text-sm">
                Seus amigos criam uma conta usando seu código e ganham 50 pontos imediatamente.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <Gift className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">3. Você Ganha</h3>
              <p className="text-gray-500 text-sm">
                Você recebe 100 pontos por cada amigo e mais bônus se eles virarem clientes!
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
