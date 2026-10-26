import React from "react";
import { MapPin, Sparkles, Compass, ShieldCheck } from "lucide-react";
import logoImg from "../../assets/logo.png";

interface HomeLandingProps {
  onLogin: (token?: string) => void;
  inviteNotice?: {
    token: string;
    tripTitle: string;
  } | null;
  isLoading?: boolean;
}

export const HomeLanding: React.FC<HomeLandingProps> = ({
  onLogin,
  inviteNotice,
  isLoading = false,
}) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 flex flex-col items-center justify-between p-6 sm:p-8 select-none relative overflow-hidden">
      {/* Background Subtle Map Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header Placeholder for Balance */}
      <div className="w-full max-w-5xl flex items-center justify-between py-2 z-10">
        <div className="flex items-center gap-2 text-slate-600 text-xs font-medium tracking-wide">
          <Compass className="w-4 h-4 text-blue-500 animate-spin-slow" />
          <span>TripMap • Suas Viagens no Mapa</span>
        </div>
      </div>

      {/* Central Login Card */}
      <div className="w-full max-w-md my-auto z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-10 shadow-2xl shadow-slate-200/60 border border-slate-200/80 flex flex-col items-center text-center transition-all">
          {/* Brand Logo */}
          <div className="relative mb-5 group">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl blur-md opacity-20 group-hover:opacity-35 transition duration-500" />
            <img
              src={logoImg}
              alt="TripMap Logo"
              className="relative w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-md rounded-2xl transform transition duration-300 group-hover:scale-105"
            />
          </div>

          {/* Heading & Tagline */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            TripMap
          </h1>
          <p className="text-sm text-slate-600 max-w-xs leading-relaxed mb-6 font-normal">
            Organize, explore e reviva todas as fotos e vídeos das suas viagens no mapa interativo.
          </p>

          {/* Contextual Trip Invitation Card */}
          {inviteNotice && (
            <div className="w-full mb-6 p-4 rounded-2xl bg-blue-50/90 border border-blue-200/80 text-left flex items-start gap-3 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider">
                  Convite de Viagem
                </p>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {inviteNotice.tripTitle}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Entre com sua conta Google para visualizar o roteiro e colaborar com fotos.
                </p>
              </div>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            onClick={() => onLogin(inviteNotice?.token)}
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300/90 shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer group active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {/* Google 4-Color Icon */}
            <svg
              className="w-5 h-5 transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {inviteNotice ? "Entrar com Google e Participar" : "Entrar com Google"}
            </span>
          </button>

          {/* Privacy & Feature Highlights */}
          <div className="mt-8 pt-6 border-t border-slate-100 w-full grid grid-cols-2 gap-4 text-left">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-800">Privado & Seguro</p>
                <p className="text-[10px] text-slate-500">Apenas você e quem você convidar</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-800">Roteiro no Mapa</p>
                <p className="text-[10px] text-slate-500">Agrupamento inteligente por atrativo</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-5xl py-3 text-center text-xs text-slate-400 z-10">
        TripMap © {new Date().getFullYear()} • Plataforma de fotos e viagens geoespaciais
      </footer>
    </div>
  );
};
