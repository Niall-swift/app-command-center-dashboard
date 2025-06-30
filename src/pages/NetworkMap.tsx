
import React from 'react';
import { motion } from 'framer-motion';
import NetworkMap from '@/components/network/NetworkMap';

const NetworkMapPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mapa da Rede</h1>
        <p className="text-gray-600 mt-2">
          Visualize todos os pontos da rede, calcule rotas otimizadas e acompanhe motoristas em tempo real
        </p>
      </div>

      <NetworkMap />
    </motion.div>
  );
};

export default NetworkMapPage;
