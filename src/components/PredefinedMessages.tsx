
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Client } from '@/types/dashboard';

interface PredefinedMessagesProps {
  client: Client;
  onSelectMessage: (message: string) => void;
}

export default function PredefinedMessages({ client, onSelectMessage }: PredefinedMessagesProps) {
  const predefinedMessages = [
    `Olá ${client.name}! Como posso ajudá-lo hoje?`,
    `Oi ${client.name}, obrigado por entrar em contato conosco!`,
    `${client.name}, estou aqui para resolver sua dúvida. Em que posso ajudar?`,
    `Olá ${client.name}! Vou verificar isso para você agora.`,
    `${client.name}, agradeço sua paciência. Já estou resolvendo sua solicitação.`,
    `Oi ${client.name}, posso ajudar com mais alguma coisa?`
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const messageVariants = {
    hidden: { opacity: 0, x: 20, scale: 0.95 },
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
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <MessageSquare className="w-4 h-4" />
            </motion.div>
            Mensagens Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={client.id}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {predefinedMessages.map((message, index) => (
                <motion.div
                  key={index}
                  variants={messageVariants}
                  whileHover={{ 
                    scale: 1.02, 
                    backgroundColor: "rgba(59, 130, 246, 0.05)",
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectMessage(message)}
                    className="w-full text-left justify-start h-auto p-2 text-xs hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
                  >
                    {message}
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
