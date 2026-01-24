
import React, { useState, useEffect} from 'react';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Trophy, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ClientList from '@/components/raffle/ClientList';
import RaffleAnimation from '@/components/raffle/RaffleAnimation';
import WinnerCard from '@/components/raffle/WinnerCard';
import type { Client } from '@/types/dashboard';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Mock data for clients with additional fields

const prizes = [
  'liquidificador',
  'fritadeira elétrica',
  'conjunto de panelas',
  'aspirador de pó',
  'caixa de som bluetooth',
  'kit de ferramentas',
  'prancha de cabelo',
  'kit de maquiagem',
  'ventilador',
  'batedeira',
  'micro-ondas',
  'pix de R$100,00',
];

export default function Raffle() {
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [isRaffling, setIsRaffling] = useState(false);
  const [winner, setWinner] = useState<Client | null>(null);
  const [selectedPrize, setSelectedPrize] = useState(prizes[0]);
  const [showWinnerCard, setShowWinnerCard] = useState(false);
  const [usersPremix, setUsersPremix] = useState<Client[]>([]);


   useEffect(() => {
     const fetchClients = async () => {
       try {
         const querySnapshot = await getDocs(collection(db, 'usuariosDoPreMix'));
         const users = querySnapshot.docs.map(doc => {
           const data = doc.data();
           return {
             id: doc.id,
             name: data.name || data.nome,
             phone: data.whatsapp || '',
             cep: data.cep || '',
             cpf: data.cpf || '',
             instagram: data.instagram || '',
             avatar: data.imageUrl || '',
             address: data.address || '',
             city: data.city || '',
             state: data.state || '',
             lastMessage: '',
             lastMessageTime: new Date(),
             unreadCount: 0,
             isOnline: false,
           } as Client;
         });
         setUsersPremix(users);
       } catch (error) {
         console.error('Erro ao buscar usuários do Firebase:', error);
         // Fallback para dados mock
         const mockUsers: Client[] = [
           {
             id: '1',
             name: 'João Silva',
             phone: '5511999999999',
             cep: '01234567',
             cpf: '12345678901',
             instagram: 'joao_silva',
             avatar: '',
             address: 'Rua das Flores, 123',
             city: 'São Paulo',
             state: 'SP',
             lastMessage: '',
             lastMessageTime: new Date(),
             unreadCount: 0,
             isOnline: false,
           },
           {
             id: '2',
             name: 'Maria Santos',
             phone: '5511988888888',
             cep: '01234567',
             cpf: '12345678902',
             instagram: 'maria_santos',
             avatar: '',
             address: 'Av. Paulista, 456',
             city: 'São Paulo',
             state: 'SP',
             lastMessage: '',
             lastMessageTime: new Date(),
             unreadCount: 0,
             isOnline: false,
           },
           {
             id: '3',
             name: 'Pedro Oliveira',
             phone: '5511977777777',
             cep: '01234567',
             cpf: '12345678903',
             instagram: 'pedro_oliveira',
             avatar: '',
             address: 'Rua do Comércio, 789',
             city: 'Rio de Janeiro',
             state: 'RJ',
             lastMessage: '',
             lastMessageTime: new Date(),
             unreadCount: 0,
             isOnline: false,
           },
         ];
         setUsersPremix(mockUsers);
       }
     };
     fetchClients();
   }, []);

  const handleClientToggle = (client: Client) => {
    setSelectedClients(prev => {
      const isSelected = prev.some(c => c.id === client.id);
      if (isSelected) {
        return prev.filter(c => c.id !== client.id);
      } else {
        return [...prev, client];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedClients(usersPremix);
  };

  const handleDeselectAll = () => {
    setSelectedClients([]);
  };

  const handleRaffle = () => {
    if (selectedClients.length === 0) return;
    
    setIsRaffling(true);
    setWinner(null);
    setShowWinnerCard(false);
    
    // Simular sorteio com delay
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * selectedClients.length);
      const winnerClient = selectedClients[randomIndex];
      setWinner(winnerClient);
      setIsRaffling(false);
      
      // Mostrar card após animação
      setTimeout(() => {
        setShowWinnerCard(true);
      }, 1000);
    }, 3000);
  };

  const resetRaffle = () => {
    setWinner(null);
    setShowWinnerCard(false);
    setSelectedClients([]);
  };

  console.log('Raffle rendering', usersPremix.length);
  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Gift className="w-8 h-8 text-purple-600" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900">Sorteio de Prêmios</h1>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Sparkles className="w-8 h-8 text-yellow-500" />
            </motion.div>
          </div>
          <p className="text-gray-600">Selecione os participantes e realize o sorteio!</p>
        </motion.div>

        {/* Prize Selection */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <Trophy className="w-5 h-5" />
                Prêmio do Sorteio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={selectedPrize}
                onChange={(e) => setSelectedPrize(e.target.value)}
                className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {prizes.map((prize) => (
                  <option key={prize} value={prize}>{prize}</option>
                ))}
              </select>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client List */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <ClientList
              clients={usersPremix}
              selectedClients={selectedClients}
              onClientToggle={handleClientToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
            />
          </motion.div>

          {/* Raffle Area */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-6"
          >
            {/* Raffle Button */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6 text-center">
                <div className="mb-4">
                  <p className="text-gray-600 mb-2">
                    {selectedClients.length} participantes selecionados
                  </p>
                  <Button
                    onClick={handleRaffle}
                    disabled={selectedClients.length === 0 || isRaffling}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 text-lg font-semibold shadow-lg transform transition-all duration-200 hover:scale-105"
                    size="lg"
                  >
                    {isRaffling ? 'Sorteando...' : 'Realizar Sorteio'}
                  </Button>
                </div>
                
                {winner && (
                  <Button
                    onClick={resetRaffle}
                    variant="outline"
                    className="mt-3"
                  >
                    Novo Sorteio
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Raffle Animation */}
            {(isRaffling || winner) && (
              <RaffleAnimation
                isRaffling={isRaffling}
                winner={winner}
                selectedClients={selectedClients}
              />
            )}
          </motion.div>
        </div>

        {/* Winner Card */}
        {showWinnerCard && winner && (
          <WinnerCard
            winner={winner}
            prize={selectedPrize}
            onClose={() => setShowWinnerCard(false)}
          />
        )}
      </div>
    </PageTransition>
  );
}
