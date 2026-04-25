
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Sunrise, Send, Settings, User, X, Check, Search, Users } from "lucide-react";
import { db } from "@/config/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

interface AttendantCardProps {
  onSendMessage: (message: string, media?: { type: 'image' | 'audio', url: string }) => void;
}

export default function AttendantCard({ onSendMessage }: AttendantCardProps) {
  const [greeting, setGreeting] = useState("");
  const [icon, setIcon] = useState<React.ReactNode>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [allAttendants, setAllAttendants] = useState<any[]>([]);
  
  // Perfil selecionado
  const [attendant, setAttendant] = useState(() => {
    const saved = localStorage.getItem('avl_selected_attendant');
    return saved ? JSON.parse(saved) : {
      name: "Selecionar Atendente",
      role: "Clique na engrenagem",
      avatar: ""
    };
  });

  // Carregar lista de atendentes ativos
  useEffect(() => {
    const q = query(collection(db, "attendants"), where("status", "==", "ativo"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllAttendants(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) {
        setGreeting("Bom dia");
        setIcon(<Sunrise className="w-4 h-4 text-orange-400" />);
      } else if (hour >= 12 && hour < 18) {
        setGreeting("Boa tarde");
        setIcon(<Sun className="w-4 h-4 text-yellow-400" />);
      } else {
        setGreeting("Boa noite");
        setIcon(<Moon className="w-4 h-4 text-blue-300" />);
      }
    };

    updateGreeting();
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  const selectProfile = (p: any) => {
    setAttendant(p);
    localStorage.setItem('avl_selected_attendant', JSON.stringify(p));
    setIsSelecting(false);
  };

  const welcomeMessage = `Olá, ${greeting}! Me chamo ${attendant.name}, sou atendente da AVL Telecom. Como posso te ajudar hoje?`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 relative"
    >
      <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
        
        <CardContent className="p-4 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <Avatar className="w-12 h-12 ring-2 ring-blue-500/30">
                <AvatarImage src={attendant.avatar} />
                <AvatarFallback className="bg-slate-800 text-blue-400 font-bold">
                  {attendant.name[0]}
                </AvatarFallback>
              </Avatar>
              {attendant.avatar && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-slate-900" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">{greeting}</span>
                {icon}
              </div>
              <h3 className="text-sm font-bold text-white truncate leading-tight">{attendant.name}</h3>
              <p className="text-[9px] text-slate-400 font-medium truncate uppercase tracking-widest">{attendant.role}</p>
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/10 text-slate-400"
              onClick={() => setIsSelecting(true)}
            >
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button 
            size="sm"
            disabled={!attendant.avatar || attendant.name === "Selecionar Atendente"}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white gap-2 text-[10px] h-8 font-bold"
            onClick={() => onSendMessage(welcomeMessage, { type: 'image', url: attendant.avatar })}
          >
            <Send className="w-3 h-3" />
            Enviar Apresentação com Foto
          </Button>
        </CardContent>
      </Card>

      {/* Modal de Seleção de Atendente */}
      <AnimatePresence>
        {isSelecting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setIsSelecting(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-900 p-6 text-white text-center relative">
                <button 
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                  onClick={() => setIsSelecting(false)}
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold">Quem é você?</h2>
                <p className="text-xs text-slate-400 mt-1">Selecione seu perfil de atendimento</p>
              </div>

              <div className="p-4 overflow-y-auto space-y-2">
                {allAttendants.map((p) => (
                  <button
                    key={p.id}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all ${
                      attendant.id === p.id 
                        ? 'border-blue-500 bg-blue-50 shadow-sm' 
                        : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                    }`}
                    onClick={() => selectProfile(p)}
                  >
                    <Avatar className="w-10 h-10 border shadow-sm">
                      <AvatarImage src={p.avatar} />
                      <AvatarFallback className="bg-gray-200 text-gray-500 font-bold">{p.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">{p.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">{p.role}</p>
                    </div>
                    {attendant.id === p.id && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
                  </button>
                ))}

                {allAttendants.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 italic">Nenhum atendente cadastrado.</p>
                    <p className="text-xs text-gray-400 mt-1">Peça ao Admin para cadastrar em Configurações.</p>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-gray-50 border-t">
                <Button variant="outline" className="w-full" onClick={() => setIsSelecting(false)}>
                  Fechar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
