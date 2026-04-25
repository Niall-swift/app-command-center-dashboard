
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Plus, Trash2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { db } from "@/config/firebase";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";
import type { Client } from '@/types/dashboard';

interface PredefinedMessagesProps {
  client: Client;
  onSelectMessage: (message: string) => void;
}

export default function PredefinedMessages({ client, onSelectMessage }: PredefinedMessagesProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Carregar mensagens do Firestore
  useEffect(() => {
    const q = query(collection(db, "quick_replies"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(data);
      
      // Se a coleção estiver vazia, criar mensagens padrão iniciais
      if (snapshot.empty) {
        initializeDefaultMessages();
      }
    });
    return () => unsubscribe();
  }, []);

  const initializeDefaultMessages = async () => {
    const defaults = [
      "Olá {client.name}! Como posso ajudá-lo hoje?",
      "Oi {client.name}, obrigado por entrar em contato conosco!",
      "Vou verificar isso para você agora.",
      "Agradeço sua paciência. Já estou resolvendo sua solicitação."
    ];
    for (const text of defaults) {
      await addDoc(collection(db, "quick_replies"), {
        text,
        createdAt: serverTimestamp()
      });
    }
  };

  const handleAddMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, "quick_replies"), {
        text: newMessage,
        createdAt: serverTimestamp()
      });
      setNewMessage("");
      setIsAdding(false);
    } catch (e) {
      console.error("Erro ao adicionar:", e);
    }
  };

  const handleDeleteMessage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "quick_replies", id));
    } catch (e) {
      console.error("Erro ao deletar:", e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="flex flex-col gap-2 h-full"
    >
      <Card className="bg-white shadow-sm flex-1 flex flex-col overflow-hidden border-none shadow-md">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 bg-gray-50/50 border-b">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            Mensagens Rápidas
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-full hover:bg-blue-100 text-blue-600"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
          <AnimatePresence>
            {isAdding && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-4"
              >
                <Input 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Dica: Use {client.name} para o nome"
                  className="text-xs mb-2 h-9 border-blue-200 focus-visible:ring-blue-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="default" className="flex-1 h-8 text-[10px] bg-blue-600" onClick={handleAddMessage}>
                    <Check className="w-3 h-3 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-[10px]" onClick={() => setIsAdding(false)}>
                    <X className="w-3 h-3" /> Cancelar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="popLayout">
            {messages.map((msg) => {
              const processedText = msg.text.replace(/\{client.name\}/g, client.name);
              
              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectMessage(processedText)}
                    className="w-full text-left justify-start h-auto py-2.5 px-3 text-xs hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 pr-10 whitespace-normal break-words border-gray-100 shadow-sm"
                  >
                    {processedText}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    onClick={(e) => handleDeleteMessage(msg.id, e)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {messages.length === 0 && !isAdding && (
            <div className="flex flex-col items-center justify-center py-8 opacity-40">
              <MessageSquare className="w-8 h-8 mb-2" />
              <p className="text-[10px] text-center italic">
                Nenhuma frase salva. <br/> Clique no + para começar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
