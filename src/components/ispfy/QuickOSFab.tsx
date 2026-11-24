import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket } from 'lucide-react';
import { QuickOSModal } from '@/components/ispfy/QuickOSModal';
import { useActiveChatClient } from '@/contexts/ActiveChatClientContext';
import { obterNomeClienteISPFY } from '@/utils/ispfyFormatters';

/**
 * Botão flutuante (FAB) que fica fixo no canto inferior direito da tela.
 * Na tela de Chat, pré-seleciona automaticamente o cliente ISPFY da conversa ativa.
 */
const QuickOSFab: React.FC = () => {
  const [hovered, setHovered] = useState(false);
  const location = useLocation();
  const { activeIspfyClient } = useActiveChatClient();

  const isChatRoute = location.pathname === '/chat';
  const preselectedClient = isChatRoute && activeIspfyClient ? activeIspfyClient : undefined;
  const preselectedName = preselectedClient ? obterNomeClienteISPFY(preselectedClient) : '';
  const tooltipLabel = preselectedName
    ? `Nova O.S. — ${preselectedName}`
    : 'Nova O.S. Rápida';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: 8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none bg-[#0f1117]/90 backdrop-blur-md text-white text-sm font-medium px-3 py-1.5 rounded-xl border border-white/10 shadow-lg whitespace-nowrap max-w-[260px] truncate"
          >
            {tooltipLabel}
          </motion.div>
        )}
      </AnimatePresence>

      <QuickOSModal
        preselectedClient={preselectedClient}
        allowChangeClient={Boolean(preselectedClient)}
        trigger={
          <motion.button
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl shadow-green-500/30 border border-white/10 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
            }}
            aria-label={tooltipLabel}
            title={tooltipLabel}
          >
            {/* Glow pulse */}
            <span
              className="absolute inset-0 rounded-2xl animate-pulse opacity-30"
              style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }}
            />
            {preselectedClient && (
              <span
                className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-emerald-700 z-20"
                aria-hidden="true"
              />
            )}
            <Ticket className="w-6 h-6 text-white relative z-10 drop-shadow-sm" />
          </motion.button>
        }
      />
    </div>
  );
};

export default QuickOSFab;
