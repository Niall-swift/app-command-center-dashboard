
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Client } from '@/types/dashboard';

interface ClientListProps {
  clients: Client[];
  selectedClients: Client[];
  onClientToggle: (client: Client) => void;
}

export default function ClientList({ clients, selectedClients, onClientToggle }: ClientListProps) {
  const isSelected = (client: Client) => selectedClients.some(c => c.id === client.id);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      x: 0, 
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  return (
    <Card className="bg-white shadow-lg h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-800">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Users className="w-5 h-5 text-blue-600" />
          </motion.div>
          Lista de Participantes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3 max-h-96 overflow-y-auto"
        >
          <AnimatePresence>
            {clients.map((client) => (
              <motion.div
                key={client.id}
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.02,
                  backgroundColor: isSelected(client) ? "rgba(147, 51, 234, 0.1)" : "rgba(59, 130, 246, 0.05)",
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onClientToggle(client)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                  isSelected(client)
                    ? 'border-purple-500 bg-purple-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={client.avatar} alt={client.name} />
                        <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                          {client.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {client.isOnline && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"
                        />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{client.name}</p>
                      <p className="text-sm text-gray-500">@{client.name.toLowerCase().replace(' ', '')}</p>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {isSelected(client) && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center"
                      >
                        <Check className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 p-3 bg-gray-50 rounded-lg text-center"
        >
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-purple-600">{selectedClients.length}</span> de{' '}
            <span className="font-semibold">{clients.length}</span> participantes selecionados
          </p>
        </motion.div>
      </CardContent>
    </Card>
  );
}
