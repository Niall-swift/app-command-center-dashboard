import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background text-foreground text-center">
          <div className="max-w-md w-full space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertCircle className="w-12 h-12 text-destructive" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-foreground">
              Ops! Algo deu errado.
            </h1>
            
            <p className="text-muted-foreground">
              Ocorreu um erro inesperado na aplicação. Tente recarregar a página para corrigir o problema.
            </p>

            <Alert variant="destructive" className="text-left bg-card border-destructive/30 text-card-foreground">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Detalhes do Erro</AlertTitle>
              <AlertDescription className="mt-2 text-xs font-mono bg-destructive/10 text-destructive p-2 rounded overflow-auto max-h-32">
                {this.state.error?.message || "Erro desconhecido"}
              </AlertDescription>
            </Alert>

            <Button 
              onClick={this.handleReload} 
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Recarregar Página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
