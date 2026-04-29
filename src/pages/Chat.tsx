import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send,
  Search,
  MessageCircle,
  Volume2,
  Bell,
  BellOff,
  Settings,
  Bug,
  Mic,
  Camera,
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  CheckCheck,
  X,
  MessageSquare,
  Bot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PredefinedMessages from "@/components/PredefinedMessages";
import AttendantCard from "@/components/AttendantCard";
import ClientInfoCard from "@/components/ClientInfoCard";
import PageTransition from "@/components/PageTransition";
import NotificationSettings from "@/components/NotificationSettings";
import DebugPanel from "@/components/DebugPanel";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { useChatNotifications } from "@/contexts/ChatNotificationContext";
import type { Message, Client } from "@/types/dashboard";
import { db } from "@/config/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/config/firebase";
import { format } from "date-fns";
import { aiService } from "@/services/ai/aiService";

export default function Chat() {
  const [clients, setClients] = useState<Client[]>([]);
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientMessages, setClientMessages] = useState<Record<string, Message[]>>({});
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showRecordingUI, setShowRecordingUI] = useState(false);
  const [canRecord, setCanRecord] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null);
  
  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isSupported, permission, isEnabled, isPageVisible, requestPermission, toggleNotifications, testNotification } = useNotifications();

  // Buscar clientes
  useEffect(() => {
    setLoading(true);
    const chatRef = collection(db, "chat");
    const q = query(chatRef, limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs
        .filter((doc) => doc.id.length <= 15) // Ignora IDs muito longos (grupos do WhatsApp têm 18+ dígitos)
        .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || "Cliente sem nome",
          avatar: data.avatar || data.name?.charAt(0) || "C",
          lastMessage: data.lastMessage || "Nenhuma mensagem",
          lastMessageTime: data.lastMessageTime?.toDate() || new Date(),
          unreadCount: data.unreadCount || 0,
          isOnline: data.isOnline || false,
          phone: data.phone,
          source: data.source || 'app',
          tags: data.tags || [],
          aiEnabled: data.aiEnabled || false,
        };
      }).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
      setClients(clientsData);
      setLoading(false);
      if (clientsData.length > 0 && !selectedClient) {
        setSelectedClient(clientsData[0]);
      }
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return unsubscribe;
  }, [selectedClient]);

  // Sincronizar o selectedClient com a lista atualizada (para pegar mudanças de aiEnabled, etc)
  useEffect(() => {
    if (selectedClient && clients.length > 0) {
      const updatedClient = clients.find(c => c.id === selectedClient.id);
      if (updatedClient && (
        updatedClient.aiEnabled !== selectedClient.aiEnabled || 
        updatedClient.unreadCount !== selectedClient.unreadCount
      )) {
        setSelectedClient(updatedClient);
      }
    }
  }, [clients, selectedClient]);

  // Buscar mensagens
  useEffect(() => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    if (!selectedClient) return;

    const mensagensRef = collection(db, "chat", selectedClient.id, "mensagens");
    const q = query(mensagensRef, orderBy("timestamp", "asc"));

    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          user: data.user,
          content: data.content,
          text: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          isAdmin: data.isAdmin || false,
          fromMe: data.isAdmin || false,
          mediaType: data.mediaType,
          mediaUrl: data.mediaUrl,
          source: data.source,
        };
      });

      setClientMessages((prev) => ({
        ...prev,
        [selectedClient.id]: messages,
      }));
    });

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [selectedClient]);

  // Lógica de Processamento da IA
  useEffect(() => {
    const processAIMessage = async () => {
      if (!selectedClient) return;
      
      const messages = clientMessages[selectedClient.id] || [];
      if (messages.length === 0) return;

      const lastMessage = messages[messages.length - 1];
      
      console.log("🔍 Verificando IA para:", selectedClient.name, {
        aiEnabled: selectedClient.aiEnabled,
        lastMessageUser: lastMessage.user,
        isAdmin: lastMessage.isAdmin,
        isNew: lastMessage.id !== lastProcessedMessageId,
        content: lastMessage.content
      });

      if (!selectedClient.aiEnabled) return;

      const isFromClient = !lastMessage.isAdmin;
      const isNew = lastMessage.id !== lastProcessedMessageId;
      const isText = !!lastMessage.content;

      if (isFromClient && isNew && isText) {
        console.log(`🚀 DISPARANDO IA PARA: ${selectedClient.name}`);
        setLastProcessedMessageId(lastMessage.id || null);
        
        try {
          const response = await aiService.generateResponse(messages, selectedClient.name);
          await handleSendMessage(response);
          console.log(`✅ IA RESPONDEU: ${selectedClient.name}`);
        } catch (error) {
          console.error("❌ ERRO CRÍTICO NA IA:", error);
        }
      }
    };

    processAIMessage();
  }, [clientMessages, selectedClient, lastProcessedMessageId]);

  const handleSendMessage = async (text?: string, media?: { type: 'image' | 'audio', url: string }) => {
    const messageText = text || newMessage;
    if ((messageText.trim() || media) && selectedClient) {
      try {
        const message: any = {
          user: "Admin",
          content: messageText,
          timestamp: new Date(),
          isAdmin: true,
          source: 'app'
        };

        if (media) {
          message.mediaType = media.type;
          message.mediaUrl = media.url;
        }

        await addDoc(collection(db, "chat", selectedClient.id, "mensagens"), message);
        await setDoc(doc(db, "chat", selectedClient.id), {
          lastMessage: media && !messageText ? (media.type === 'image' ? '📎 Imagem' : '🎵 Áudio') : messageText,
          lastMessageTime: new Date(),
        }, { merge: true });

        setNewMessage("");
      } catch (error) {
        toast({ title: "Erro ao enviar", variant: "destructive" });
      }
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    if (client.unreadCount > 0) {
      setDoc(doc(db, "chat", client.id), { unreadCount: 0 }, { merge: true });
    }
  };

  const handlePredefinedMessage = (message: string) => {
    setNewMessage(message);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedClient) {
      const fileRef = ref(storage, `chat/${selectedClient.id}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      handleSendMessage("", { type: 'image', url });
      setShowMediaModal(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        const fileRef = ref(storage, `chat/${selectedClient?.id}/${Date.now()}.webm`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        handleSendMessage("", { type: 'audio', url });
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
      setShowRecordingUI(true);
      setRecordingTime(0);
      const timer = setInterval(() => setRecordingTime(p => p + 1), 1000);
      (recorder as any)._timer = timer;
    } catch (e) {
      toast({ title: "Erro no microfone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      clearInterval((mediaRecorder as any)._timer);
      setIsRecording(false);
      setShowRecordingUI(false);
    }
  };

  const playAudio = (url: string) => {
    const audio = new Audio(url);
    audio.play();
    setCurrentPlayingAudio(url);
    audio.onended = () => setCurrentPlayingAudio(null);
  };

  const stopAudio = () => {
    const audios = document.querySelectorAll('audio');
    audios.forEach(a => { a.pause(); a.currentTime = 0; });
    setCurrentPlayingAudio(null);
  };

  const expandImage = (url: string) => {
    setSelectedImageUrl(url);
    setShowImageModal(true);
  };

  const testNotificationSound = () => testNotification();

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentMessages = selectedClient ? clientMessages[selectedClient.id] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  return (
    <PageTransition>
      <div className="flex h-[calc(100vh-64px)] bg-[#f8fafc] overflow-hidden p-3 gap-3">
        {/* Coluna Esquerda */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-80 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-50 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                Mensagens
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none px-1.5 h-5 text-[10px]">
                  {clients.filter(c => c.unreadCount > 0).length} novas
                </Badge>
              </h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-400" onClick={testNotificationSound}>
                  <Bell className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-400" onClick={() => setShowDebugPanel(!showDebugPanel)}>
                  <Bug className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar conversa..."
                className="pl-9 h-9 bg-gray-50 border-none rounded-xl text-sm focus-visible:ring-1 focus-visible:ring-blue-100 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            <AnimatePresence>
              {filteredClients.map((client, index) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleClientSelect(client)}
                  className={`p-3 rounded-xl cursor-pointer transition-all relative ${
                    selectedClient?.id === client.id ? "bg-blue-50 shadow-inner" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
                        <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">
                          {client.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {client.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                      )}
                      {client.aiEnabled && (
                        <div className="absolute -top-1 -right-1 bg-indigo-600 text-white p-0.5 rounded-full border border-white shadow-sm" title="IA Ativa">
                          <Bot className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="font-bold text-sm text-gray-800 truncate flex items-center gap-1.5">
                          {client.name}
                          {client.source === 'whatsapp' && (
                            <Badge className="bg-green-100 text-green-700 border-none text-[9px] h-3.5 px-1 font-bold">WA</Badge>
                          )}
                        </h4>
                        <span className="text-[10px] text-gray-400">
                          {format(client.lastMessageTime, 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate leading-relaxed">
                        {client.lastMessage}
                      </p>
                      {client.tags && client.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {client.tags.map(tagId => (
                            <div key={tagId} className={`w-1.5 h-1.5 rounded-full ${
                              tagId === 'suporte' ? 'bg-blue-400' : 
                              tagId === 'financeiro' ? 'bg-orange-400' : 
                              tagId === 'vendas' ? 'bg-green-400' : 
                              tagId === 'urgente' ? 'bg-red-400' : 'bg-gray-400'
                            }`} />
                          ))}
                        </div>
                      )}
                    </div>
                    {client.unreadCount > 0 && (
                      <Badge className="bg-blue-600 text-white border-none h-5 min-w-[20px] justify-center px-1 text-[10px]">
                        {client.unreadCount}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Coluna Central */}
        <motion.div layout className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
          {selectedClient ? (
            <>
              <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold">
                      {selectedClient.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">{selectedClient.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium ${selectedClient.isOnline ? 'text-green-500' : 'text-gray-400'}`}>
                        {selectedClient.isOnline ? 'Online' : 'Offline'}
                      </span>
                      <span className="text-[10px] text-gray-300">•</span>
                      <span className="text-[10px] text-gray-400 font-mono">{selectedClient.id}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-gray-400"><Phone className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-gray-400"><Video className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-gray-400"><MoreVertical className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-[#fcfdfe] space-y-4 custom-scrollbar">
                {currentMessages.map((message, index) => (
                  <div key={message.id || index} className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${
                        message.fromMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                      }`}
                    >
                      {message.mediaType === 'image' && message.mediaUrl && (
                        <img src={message.mediaUrl} alt="Mídia" className="max-w-full h-auto rounded-lg mb-2 cursor-pointer" onClick={() => expandImage(message.mediaUrl!)} />
                      )}
                      {message.mediaType === 'audio' && message.mediaUrl ? (
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-white/20 text-white" onClick={() => currentPlayingAudio === message.mediaUrl ? stopAudio() : playAudio(message.mediaUrl!)}>
                            {currentPlayingAudio === message.mediaUrl ? <Volume2 className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
                          </Button>
                          <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                            <div className="h-full bg-white transition-all" style={{ width: currentPlayingAudio === message.mediaUrl ? '40%' : '0%' }} />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text || message.content}</p>
                      )}
                      <div className={`flex items-center gap-1 mt-1 justify-end ${message.fromMe ? 'text-blue-100' : 'text-gray-400'}`}>
                        <span className="text-[10px]">{format(message.timestamp, 'HH:mm')}</span>
                        {message.fromMe && <CheckCheck className="w-3 h-3" />}
                        {message.source === 'whatsapp' && <span className="text-[8px] font-bold ml-1">WA</span>}
                      </div>
                    </motion.div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-gray-50">
                <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100 focus-within:border-blue-200 focus-within:bg-white transition-all shadow-inner">
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-400" onClick={() => setShowMediaModal(true)}><Paperclip className="w-5 h-5" /></Button>
                  <textarea
                    placeholder="Escreva uma mensagem..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2.5 resize-none max-h-32"
                    rows={1}
                    value={newMessage}
                    onChange={(e) => { setNewMessage(e.target.value); e.target.style.height = 'inherit'; e.target.style.height = `${e.target.scrollHeight}px`; }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  />
                  <Button className="h-10 w-10 bg-blue-600 rounded-xl" onClick={() => handleSendMessage()} disabled={!newMessage.trim()}><Send className="w-5 h-5" /></Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="p-8 bg-white rounded-3xl shadow-xl border border-gray-100 max-w-sm">
                <MessageSquare className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800">Selecione uma conversa</h3>
                <p className="text-sm text-gray-500 mt-2">Escolha um cliente na lista lateral para iniciar o atendimento.</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Coluna Direita */}
        {selectedClient && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-80 flex flex-col gap-3 overflow-y-auto pb-2">
            <ClientInfoCard clientId={selectedClient.id} clientPhone={selectedClient.phone} clientName={selectedClient.name} onSendMessage={handleSendMessage} />
            <AttendantCard onSendMessage={(msg, media) => handleSendMessage(msg, media)} />
            <PredefinedMessages client={selectedClient} onSelectMessage={handlePredefinedMessage} />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showNotificationSettings && (
          <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNotificationSettings(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()}>
              <NotificationSettings isEnabled={isEnabled} isSupported={isSupported} permission={permission} isPageVisible={isPageVisible} onToggleNotifications={toggleNotifications} onRequestPermission={requestPermission} onTestNotification={testNotification} />
            </motion.div>
          </motion.div>
        )}

        {showDebugPanel && (
          <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDebugPanel(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()} className="max-w-4xl w-full">
              <DebugPanel isEnabled={isEnabled} isSupported={isSupported} permission={permission} isPageVisible={isPageVisible} selectedClient={selectedClient} clientMessages={clientMessages} onTestSound={testNotificationSound} onTestNotification={testNotification} />
            </motion.div>
          </motion.div>
        )}

        {showMediaModal && (
          <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMediaModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
              <h4 className="text-lg font-bold text-gray-800 mb-6 text-center">Anexar Mídia</h4>
              <div className="grid gap-3">
                <Button onClick={() => document.getElementById('photo-input-modal')?.click()} className="w-full h-14 rounded-2xl gap-3 font-bold" variant="outline"><Camera className="w-5 h-5 text-blue-500" /> Enviar Foto</Button>
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="photo-input-modal" />
                <Button onClick={() => { setShowMediaModal(false); startRecording(); }} className="w-full h-14 rounded-2xl gap-3 font-bold bg-red-50 text-red-600 border-red-100 hover:bg-red-100" variant="outline"><Mic className="w-5 h-5" /> Gravar Áudio</Button>
              </div>
              <Button onClick={() => setShowMediaModal(false)} className="w-full mt-6 text-gray-400" variant="ghost">Cancelar</Button>
            </motion.div>
          </motion.div>
        )}

        {showImageModal && (
          <motion.div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowImageModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative max-w-5xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="absolute top-0 right-0 text-white hover:bg-white/10 h-12 w-12" onClick={() => setShowImageModal(false)}><X className="w-6 h-6" /></Button>
              {selectedImageUrl && <img src={selectedImageUrl} alt="Expandida" className="max-w-full max-h-[90vh] object-contain rounded-lg" />}
            </motion.div>
          </motion.div>
        )}

        {showRecordingUI && (
          <motion.div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-md bg-gray-900/95 backdrop-blur-md rounded-3xl p-4 flex items-center justify-between shadow-2xl border border-white/10 z-[60]" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center animate-pulse"><Mic className="w-6 h-6 text-white" /></div>
              <div>
                <p className="text-white font-bold text-sm">Gravando...</p>
                <p className="text-red-400 text-xs font-mono">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => { setShowRecordingUI(false); setIsRecording(false); if (mediaRecorder) mediaRecorder.stop(); }} className="h-12 w-12 text-gray-400"><X className="w-5 h-5" /></Button>
              <Button onClick={stopRecording} className="h-12 px-6 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold">Enviar</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
