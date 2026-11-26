import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Delete, Grid3X3, Loader2, LogOut, X } from 'lucide-react';
import type { PanelUserRole } from '@/config/permissions';
import type { VerifyPinResponse } from '@/services/panelUsersService';
import {
  ACCENT_PRESETS,
  useUiPreferences,
} from '@/contexts/UiPreferencesContext';

export const SPLASH_BG_IMAGE_URL = 'https://picsum.photos/1080/180/?blur';

export interface Ps5SplashUserInfo {
  name?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  role?: PanelUserRole | null;
  jobTitle?: string | null;
}

interface Ps5UserSplashScreenProps {
  user?: Ps5SplashUserInfo | null;
  statusText?: string;
  eyebrowText?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Quando true, exibe a tela de entrada minimalista exigindo o PIN numérico de 6 dígitos */
  requirePin?: boolean;
  /** Valida o PIN de 6 dígitos no backend (ou simulado na prévia) */
  onVerifyPin?: (pin: string) => Promise<VerifyPinResponse>;
  /** Chamado quando o PIN é validado com sucesso */
  onPinVerified?: () => void;
  /** Permite sair / trocar de operador direto da tela de bloqueio */
  onSwitchAccount?: () => void;
  /** Modo prévia em Configurações (permite fechar facilmente) */
  previewMode?: boolean;
}

const PIN_LENGTH = 6;
const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

function getInitials(name?: string | null, email?: string | null): string {
  const raw = String(name || email || 'AVL').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return raw.substring(0, 2).toUpperCase();
}

export const Ps5UserSplashScreen: React.FC<Ps5UserSplashScreenProps> = ({
  user,
  statusText = 'Preparando seu ambiente...',
  dismissible = false,
  onDismiss,
  requirePin = false,
  onVerifyPin,
  onPinVerified,
  onSwitchAccount,
  previewMode = false,
}) => {
  const { preferences } = useUiPreferences();
  const [imgFailed, setImgFailed] = useState(false);
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shakeTick, setShakeTick] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [lockedUntilMs, setLockedUntilMs] = useState<number>(0);
  const [lockSecondsLeft, setLockSecondsLeft] = useState<number>(0);

  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const verifyingRef = useRef(false);

  const photoUrl = String(user?.photoUrl || '').trim();
  const hasValidPhoto = Boolean(photoUrl) && !imgFailed;
  const hasUserIdentity = Boolean(user?.name || user?.email);
  const displayName = String(user?.name || user?.email || 'AVL Telecom').trim();

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  // Foca o input numérico invisível para abrir teclado em mobile e capturar digitação imediata
  useEffect(() => {
    if (!requirePin) return;
    const timer = window.setTimeout(() => {
      hiddenInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [requirePin]);

  // Contador regressivo de bloqueio temporário (após 5 tentativas incorretas)
  useEffect(() => {
    if (!lockedUntilMs || lockedUntilMs <= Date.now()) {
      setLockSecondsLeft(0);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.ceil((lockedUntilMs - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntilMs(0);
        setLockSecondsLeft(0);
        setErrorMessage(null);
      } else {
        setLockSecondsLeft(remaining);
      }
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 500);
    return () => window.clearInterval(interval);
  }, [lockedUntilMs]);

  const submitPin = useCallback(
    async (candidatePin: string) => {
      if (verifyingRef.current) return;
      if (candidatePin.length !== PIN_LENGTH) return;
      if (lockedUntilMs > Date.now()) return;

      verifyingRef.current = true;
      setVerifying(true);
      setErrorMessage(null);

      try {
        if (!onVerifyPin) {
          onPinVerified?.();
          return;
        }
        const res = await onVerifyPin(candidatePin);
        if (res.valid) {
          onPinVerified?.();
          return;
        }

        setPin('');
        setShakeTick((prev) => prev + 1);
        if (res.lockedUntilMs && res.lockedUntilMs > Date.now()) {
          setLockedUntilMs(res.lockedUntilMs);
          setErrorMessage('Muitas tentativas incorretas. Aguarde para tentar novamente.');
        } else if (typeof res.remainingAttempts === 'number' && res.remainingAttempts > 0) {
          setErrorMessage(
            `Senha incorreta. Restam ${res.remainingAttempts} tentativa${res.remainingAttempts === 1 ? '' : 's'
            }.`
          );
        } else {
          setErrorMessage('Senha numérica incorreta. Tente novamente.');
        }
        window.setTimeout(() => hiddenInputRef.current?.focus(), 60);
      } catch (err) {
        setPin('');
        setShakeTick((prev) => prev + 1);
        setErrorMessage(
          err instanceof Error
            ? err.message.replace(/^FirebaseError:\s*/i, '')
            : 'Não foi possível validar a senha. Tente novamente.'
        );
      } finally {
        verifyingRef.current = false;
        setVerifying(false);
      }
    },
    [lockedUntilMs, onVerifyPin, onPinVerified]
  );

  const appendDigit = useCallback(
    (digit: string) => {
      if (verifyingRef.current || lockedUntilMs > Date.now()) return;
      setErrorMessage(null);
      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = `${prev}${digit}`;
        if (next.length === PIN_LENGTH) {
          void submitPin(next);
        }
        return next;
      });
    },
    [lockedUntilMs, submitPin]
  );

  const removeLastDigit = useCallback(() => {
    if (verifyingRef.current) return;
    setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  }, []);

  // Atalhos globais de teclado para digitação instantânea dos 6 dígitos (ou dismiss quando sem PIN)
  useEffect(() => {
    if (requirePin) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (previewMode && e.key === 'Escape' && onDismiss) {
          e.preventDefault();
          onDismiss();
          return;
        }
        if (document.activeElement === hiddenInputRef.current) return;

        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          appendDigit(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          removeLastDigit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setPin('');
          setErrorMessage(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }

    if (!dismissible || !onDismiss) return;
    const handleDismissKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleDismissKey);
    return () => window.removeEventListener('keydown', handleDismissKey);
  }, [requirePin, dismissible, onDismiss, previewMode, appendDigit, removeLastDigit]);

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (verifyingRef.current || lockedUntilMs > Date.now()) return;
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setErrorMessage(null);
    setPin(digitsOnly);
    if (digitsOnly.length === PIN_LENGTH) {
      void submitPin(digitsOnly);
    }
  };

  const isLockedOut = lockSecondsLeft > 0;
  const resolvedBgUrl =
    preferences.splashBgPreset === 'custom' && preferences.splashCustomBgUrl
      ? preferences.splashCustomBgUrl
      : SPLASH_BG_IMAGE_URL;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      onClick={!requirePin && dismissible ? onDismiss : undefined}
      role={requirePin ? 'dialog' : 'status'}
      aria-modal={requirePin || undefined}
      aria-label={
        requirePin
          ? `Tela de entrada de ${displayName} — digite sua senha de 6 dígitos`
          : `Carregando perfil de ${displayName}`
      }
      className={`fixed inset-0 z-[99998] overflow-y-auto flex flex-col items-center justify-center select-none bg-[#0b0d12] text-white ${!requirePin && dismissible ? 'cursor-pointer' : ''
        }`}
    >
      {/* Fundo minimalista personalizável (imagem blur padrão, escuro puro, aura da cor ou URL própria) */}
      {preferences.splashBgPreset === 'obsidian' ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 35%, #171920 0%, #07080b 100%)',
          }}
        />
      ) : preferences.splashBgPreset === 'accent' ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 32%, ${(ACCENT_PRESETS[preferences.accent] || ACCENT_PRESETS.blue).swatch
              }36 0%, #0a0c12 58%, #050609 100%)`,
          }}
        />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-cover bg-center bg-no-repeat scale-105 pointer-events-none"
            style={{
              backgroundImage: `url('${resolvedBgUrl}')`,
            }}
          />
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 42%, rgba(8, 10, 16, 0.36) 0%, rgba(5, 7, 12, 0.72) 100%)',
            }}
          />
        </>
      )}

      {/* Botão discreto para fechar prévia nas Configurações */}
      {previewMode && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="fixed top-5 right-5 z-20 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-xs font-medium text-white/90 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Fechar prévia
        </button>
      )}

      {/* Conteúdo central minimalista: Foto grande circular + Nome em negrito + PIN de 6 dígitos */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center justify-center px-6 py-10 text-center">
        {/* Foto circular grande do usuário */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-7"
        >
          <div className="w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 rounded-full overflow-hidden bg-black/40 backdrop-blur-md ring-2 ring-white/25 shadow-[0_24px_65px_-12px_rgba(0,0,0,0.65)] flex items-center justify-center">
            {hasValidPhoto ? (
              <img
                src={photoUrl}
                alt={displayName}
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover rounded-full"
              />
            ) : hasUserIdentity ? (
              <span className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white">
                {getInitials(user?.name, user?.email)}
              </span>
            ) : (
              <img
                src="/pwa-192x192.png"
                alt="AVL Telecom"
                className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
              />
            )}
          </div>
        </motion.div>

        {/* Nome grande em negrito com cumprimento */}
        <motion.h1
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.42, delay: 0.08 }}
          className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] leading-tight"
        >
          {hasUserIdentity ? (
            <>
              <span className="font-medium text-white/80">Bem-vindo de volta, </span>
              <span className="font-extrabold text-white">{displayName}</span>
            </>
          ) : (
            <span className="font-extrabold text-white">{displayName}</span>
          )}
        </motion.h1>

        {/* Área de PIN de 6 dígitos (ou barra minimalista quando em carregamento/sem PIN) */}
        {requirePin ? (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.42, delay: 0.14 }}
            className="mt-8 w-full flex flex-col items-center"
          >
            {/* Input numérico invisível para suporte nativo a teclado móvel e colagem */}
            <input
              ref={hiddenInputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={handleHiddenInputChange}
              disabled={verifying || isLockedOut}
              aria-label="Digite sua senha numérica de 6 dígitos"
              className="sr-only"
            />

            {/* 6 pontos minimalistas em vidro fosco */}
            <motion.div
              key={shakeTick}
              animate={
                shakeTick > 0
                  ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
                  : { x: 0 }
              }
              transition={{ duration: 0.36 }}
              onClick={() => hiddenInputRef.current?.focus()}
              className="flex items-center justify-center gap-3 cursor-text"
            >
              {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
                const isFilled = idx < pin.length;
                const isActive = idx === pin.length && !verifying && !isLockedOut;
                const isError = Boolean(errorMessage) && pin.length === 0;
                return (
                  <div
                    key={idx}
                    className={`w-11 h-12 sm:w-12 sm:h-14 rounded-2xl backdrop-blur-md border flex items-center justify-center transition-all duration-150 ${isError
                      ? 'border-rose-400/75 bg-rose-500/15'
                      : isActive
                        ? 'border-white/75 bg-white/15 scale-105 shadow-[0_0_24px_rgba(255,255,255,0.16)]'
                        : isFilled
                          ? 'border-white/45 bg-white/15'
                          : 'border-white/25 bg-white/[0.08]'
                      }`}
                  >
                    {isFilled && (
                      <motion.span
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.14 }}
                        className="w-3 h-3 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                      />
                    )}
                  </div>
                );
              })}
            </motion.div>

            {/* Mensagem minimalista de instrução / validação / erro */}
            <div className="mt-4 min-h-[20px] flex items-center justify-center">
              {verifying ? (
                <span className="inline-flex items-center gap-2 text-xs text-white/85 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Verificando senha...
                </span>
              ) : isLockedOut ? (
                <p className="text-xs text-rose-200 font-medium">
                  Muitas tentativas. Aguarde {lockSecondsLeft}s para tentar novamente.
                </p>
              ) : errorMessage ? (
                <p className="text-xs text-rose-200 font-medium">{errorMessage}</p>
              ) : (
                <p className="text-xs text-white/65 font-normal tracking-wide">
                  {previewMode
                    ? 'Prévia: digite 6 números para testar o desbloqueio'
                    : 'Digite sua senha numérica de 6 dígitos'}
                </p>
              )}
            </div>

            {/* Teclado numérico minimalista opcional (para mouse ou toque) */}
            <AnimatePresence>
              {showKeypad && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: 6, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mt-5"
                >
                  <div className="grid grid-cols-3 gap-2.5">
                    {KEYPAD_KEYS.map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        disabled={verifying || isLockedOut}
                        onClick={() => appendDigit(digit)}
                        className="w-16 h-12 rounded-2xl bg-white/[0.10] hover:bg-white/[0.20] active:scale-95 backdrop-blur-md border border-white/20 text-lg font-semibold text-white transition-all disabled:opacity-40"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={verifying || pin.length === 0}
                      onClick={() => {
                        setPin('');
                        setErrorMessage(null);
                      }}
                      className="w-16 h-12 rounded-2xl bg-white/[0.06] hover:bg-white/[0.15] active:scale-95 backdrop-blur-md border border-white/15 text-[11px] font-medium text-white/75 transition-all disabled:opacity-35"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      disabled={verifying || isLockedOut}
                      onClick={() => appendDigit('0')}
                      className="w-16 h-12 rounded-2xl bg-white/[0.10] hover:bg-white/[0.20] active:scale-95 backdrop-blur-md border border-white/20 text-lg font-semibold text-white transition-all disabled:opacity-40"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      disabled={verifying || pin.length === 0}
                      onClick={removeLastDigit}
                      aria-label="Apagar último dígito"
                      className="w-16 h-12 rounded-2xl bg-white/[0.06] hover:bg-white/[0.15] active:scale-95 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/80 transition-all disabled:opacity-35"
                    >
                      <Delete className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ações discretas de rodapé */}
            <div className="mt-6 flex items-center justify-center gap-5 text-xs text-white/65">
              <button
                type="button"
                onClick={() => setShowKeypad((prev) => !prev)}
                className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                {showKeypad ? 'Ocultar teclado' : 'Teclado numérico'}
              </button>
              {onSwitchAccount && (
                <button
                  type="button"
                  onClick={onSwitchAccount}
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Trocar conta
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            {/* Barra de progresso minimalista */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0.7 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.4, delay: 0.16 }}
              className="mt-7 w-40 h-[2px] rounded-full bg-white/20 overflow-hidden relative"
            >
              <motion.div
                animate={{ x: ['-100%', '220%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-y-0 left-0 w-1/2 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.92) 50%, transparent)',
                }}
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.22 }}
              className="mt-3 text-xs text-white/70 font-normal tracking-wide"
            >
              {statusText}
            </motion.p>

            {dismissible && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                className="mt-5 text-[10px] uppercase tracking-[0.22em] text-white/60"
              >
                Clique ou pressione qualquer tecla para continuar
              </motion.span>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};
