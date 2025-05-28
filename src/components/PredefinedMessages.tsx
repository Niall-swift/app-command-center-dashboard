
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from 'lucide-react';
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

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4" />
          Mensagens Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {predefinedMessages.map((message, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSelectMessage(message)}
            className="w-full text-left justify-start h-auto p-2 text-xs"
          >
            {message}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
