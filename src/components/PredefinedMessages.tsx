
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Plus, Trash2, X, Check } from 'lucide-react';
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
  serverTimestamp,
} from "firebase/firestore";
import type { Client } from '@/types/dashboard';

interface QuickReplyItem {
  id: string;
  text: string;
}

interface PredefinedMessagesProps {
  client: Client;
  onSelectMessage: (message: string) => void;
}

function PredefinedMessagesInner({ client, onSelectMessage }: PredefinedMessagesProps) {
  const [messages, setMessages] = useState<QuickReplyItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Carregar mensagens do Firestore
  useEffect(() => {
    const q = query(collection(db, "quick_replies"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: QuickReplyItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        text: String(docSnap.data().text || ""),
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
      "Agradeço sua paciência. Já estou resolvendo sua solicitação.",
    ];
    for (const text of defaults) {
      await addDoc(collection(db, "quick_replies"), {
        text,
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleAddMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, "quick_replies"), {
        text: newMessage.trim(),
        createdAt: serverTimestamp(),
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
    <Card className="bg-card shadow-sm border-border overflow-hidden">
      <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 bg-muted/30 border-b border-border/60">
        <CardTitle className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          Frases Rápidas
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md hover:bg-primary/10 text-primary"
          onClick={() => setIsAdding((prev) => !prev)}
          title="Adicionar frase rápida"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
        {isAdding && (
          <div className="bg-primary/5 p-2.5 rounded-xl border border-primary/20 space-y-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddMessage();
                } else if (e.key === 'Escape') {
                  setIsAdding(false);
                }
              }}
              placeholder="Use {client.name} para o nome"
              className="text-xs h-8 bg-background"
              autoFocus
            />
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                className="flex-1 h-7 text-[10px]"
                onClick={handleAddMessage}
              >
                <Check className="w-3 h-3 mr-1" /> Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[10px]"
                onClick={() => setIsAdding(false)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const processedText = msg.text.replace(/\{client\.name\}/g, client.name);

          return (
            <div key={msg.id} className="group relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSelectMessage(processedText)}
                className="w-full text-left justify-start h-auto py-2 px-2.5 text-xs hover:bg-primary/10 hover:border-primary/30 transition-colors pr-8 whitespace-normal break-words border-border/70 bg-background/60"
              >
                {processedText}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                onClick={(e) => handleDeleteMessage(msg.id, e)}
                title="Excluir frase"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          );
        })}

        {messages.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center py-6 opacity-50">
            <MessageSquare className="w-6 h-6 mb-1.5" />
            <p className="text-[10px] text-center italic">
              Nenhuma frase salva. <br /> Clique no + para começar.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PredefinedMessages = React.memo(PredefinedMessagesInner);
export default PredefinedMessages;
