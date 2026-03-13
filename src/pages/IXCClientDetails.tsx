import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Database } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { IXCClientDashboard } from '@/components/ixc/IXCClientDashboard';

const IXCClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <PageTransition>
      <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Database className="w-4 h-4" />
            <span>Sistema IXC</span>
            <span>/</span>
            <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/ixc/consulta')}>Consulta</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Detalhes do Cliente</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
        </div>

        <IXCClientDashboard clientId={id} />
      </div>
    </PageTransition>
  );
};

export default IXCClientDetails;
