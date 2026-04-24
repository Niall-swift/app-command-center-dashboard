
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Sparkles, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Client } from '@/types/dashboard';

interface RaffleAnimationProps {
  isRaffling: boolean;
  winner: Client | null;
  selectedClients: Client[];
}

export default function RaffleAnimation({ isRaffling, winner, selectedClients }: RaffleAnimationProps) {
  return (
    <Card className="bg-gradient-to-br from-purple-100 via-pink-50 to-yellow-100 border-purple-200 shadow-xl">
      <CardContent className="p-8">
        <AnimatePresence mode="wait">
          {isRaffling ? (
            <motion.div
              key="raffling"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <div className="relative h-48 mb-6 overflow-hidden">
                {selectedClients.slice(0, 15).map((client, index) => (
                  <motion.div
                    key={client.id}
                    className="absolute"
                    initial={{
                    x: (index * 50) % 200,
                    y: (index * 30) % 150,
                    scale: 0.5,
                    rotate: 0
                    }}
                    animate={{
                    x: [
                    (index * 50) % 200,
                    ((index * 50) + 50) % 200,
                    ((index * 50) + 100) % 200,
                    (index * 50) % 200
                    ],
                    y: [
                    (index * 30) % 150,
                    ((index * 30) + 40) % 150,
                    ((index * 30) + 80) % 150,
                    (index * 30) % 150
                    ],
                    scale: [0.5, 0.8, 0.6, 0.7],
                    rotate: [0, 180, 360, 540]
                    }}
                    transition={{
                      duration: 3 + index * 0.1, // Variar a duração para ser mais aleatório
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Avatar className="w-12 h-12 border-2 border-white shadow-lg">
                      <AvatarImage src={client.avatar} alt={client.name || 'Participante'} />
                      <AvatarFallback className="bg-purple-200 text-purple-700 font-bold">
                        {(client.name || 'P').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                ))}
                
                {/* Central spinning element */}
                <motion.div
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
              </div>
              
              <motion.h3
                className="text-2xl font-bold text-purple-700 mb-2"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                Sorteando...
              </motion.h3>
              <motion.div
                className="flex justify-center gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 bg-purple-500 rounded-full"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                  />
                ))}
              </motion.div>
            </motion.div>
          ) : winner ? (
            <motion.div
              key="winner"
              initial={{ opacity: 0, scale: 0, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="text-center"
            >
              {/* Confetti effect */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                    initial={{ 
                      x: '50%',
                      y: '50%',
                      scale: 0
                    }}
                    animate={{
                      x: `${((i * 5) + 20) % 100}%`,
                      y: `${((i * 7) + 30) % 100}%`,
                      scale: [0, 1, 0],
                      rotate: [0, 360]
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.1,
                      ease: "easeOut"
                    }}
                  />
                ))}
              </div>
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 200, 
                  damping: 15,
                  delay: 0.3 
                }}
                className="mb-6"
              >
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-3xl font-bold text-purple-700 mb-2">Parabéns!</h3>
              </motion.div>
              
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="relative"
                >
                  <Avatar className="w-24 h-24 border-4 border-yellow-400 shadow-xl">
                    <AvatarImage src={winner.avatar} alt={winner.name || 'Vencedor'} />
                    <AvatarFallback className="bg-purple-200 text-purple-700 text-2xl font-bold">
                      {(winner.name || 'V').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <motion.div
                    className="absolute -top-2 -right-2"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Star className="w-8 h-8 text-yellow-500 fill-current" />
                  </motion.div>
                </motion.div>
                
                <div>
                  <h4 className="text-2xl font-bold text-gray-900">{winner.name || 'Participante VIP'}</h4>
                  <p className="text-purple-600 font-semibold">@{(winner.name || 'vencedor').toLowerCase().replace(/\s+/g, '')}</p>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
