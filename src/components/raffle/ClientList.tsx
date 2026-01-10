
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, Check, CheckCheck, X, Search, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticipantDetailsModal from './ParticipantDetailsModal';
import type { Client } from '@/types/dashboard';

interface ClientListProps {
  clients: Client[];
  selectedClients: Client[];
  onClientToggle: (client: Client) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function ClientList({ 
  clients, 
  selectedClients, 
  onClientToggle, 
  onSelectAll, 
  onDeselectAll 
}: ClientListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Client | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const isSelected = (client: Client) => selectedClients.some(c => c.id === client.id);
  const allSelected = clients.length > 0 && clients.every(client => isSelected(client));

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.name && client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  const openDetailsModal = (client: Client) => {
    setSelectedParticipant(client);
    setIsDetailsModalOpen(true);
  };

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

  console.log('ClientList rendering', clients.length);
  return (
    <>
      <Card className="bg-white shadow-lg h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-gray-800">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Users className="w-5 h-5 text-blue-600" />
              </motion.div>
              Lista de Participantes
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSelectAll}
                variant={allSelected ? "destructive" : "default"}
                size="sm"
                className="text-xs"
              >
                {allSelected ? (
                  <>
                    <X className="w-3 h-3 mr-1" />
                    Desmarcar Todos
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-3 h-3 mr-1" />
                    Selecionar Todos
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Pesquisar participante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                  isSelected(client)
                    ? 'border-purple-500 bg-purple-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                }`}
              >
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 flex-1"
                      onClick={() => onClientToggle(client)}
                    >
                      <div className="relative">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={client.avatar} alt={client.name || 'Unknown'} />
                          <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                            {client.name ? client.name.charAt(0) : '?'}
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
                        <p className="font-semibold text-gray-900">{client.name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">@{client.name ? client.name.toLowerCase().replace(' ', '') : 'unknown'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetailsModal(client);
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      
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
                  </div>
                </div>
              ))}
          </div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 p-3 bg-gray-50 rounded-lg text-center"
          >
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-purple-600">{selectedClients.length}</span> de{' '}
              <span className="font-semibold">{filteredClients.length}</span> participantes selecionados
              {searchTerm && (
                <span className="text-gray-500"> (filtrados de {clients.length} total)</span>
              )}
            </p>
          </motion.div>
        </CardContent>
      </Card>

      <ParticipantDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        participant={selectedParticipant}
      />
    </>
  );
}
