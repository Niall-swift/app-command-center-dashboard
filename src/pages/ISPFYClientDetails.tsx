import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Database } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ISPFYClientDashboard } from '@/components/ispfy/ISPFYClientDashboard';

const ISPFYClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <PageTransition>
      <div className="space-y-5 text-foreground">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Database className="w-4 h-4 text-primary" />
            <span>Sistema ISPFY</span>
            <span>/</span>
            <button
              type="button"
              className="hover:text-primary transition-colors font-medium"
              onClick={() => navigate('/ispfy/consulta')}
            >
              Explorer 360°
            </button>
            <span>/</span>
            <span className="text-foreground font-semibold">Cliente #{id}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-1.5 rounded-xl h-8 text-xs"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
        </div>

        <ISPFYClientDashboard clientId={id} />
      </div>
    </PageTransition>
  );
};

export default ISPFYClientDetails;
