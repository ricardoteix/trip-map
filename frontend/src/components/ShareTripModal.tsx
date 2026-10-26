import React, { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Globe2,
  Lock,
  Share2,
  Shield,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  fetchTripMembers,
  fetchTripShareInfo,
  updateTripShareInfo,
} from "../api/client";
import { Trip, TripMember, User } from "../types";

interface ShareTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  currentUser: User | null;
  onTripUpdated?: (updatedTrip: Trip) => void;
}

export const ShareTripModal: React.FC<ShareTripModalProps> = ({
  isOpen,
  onClose,
  trip,
  currentUser,
  onTripUpdated,
}) => {
  const [visibility, setVisibility] = useState<"private" | "shared">(
    trip.visibility || "private"
  );
  const [shareToken, setShareToken] = useState<string | null>(
    trip.share_token || null
  );
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnerOrAdmin =
    Boolean(currentUser?.is_admin) ||
    (Boolean(currentUser?.id) && trip.owner_id === currentUser?.id) ||
    trip.user_role === "owner" ||
    !trip.owner_id;

  useEffect(() => {
    if (!isOpen) return;
    setVisibility(trip.visibility || "private");
    setShareToken(trip.share_token || null);
    setCopied(false);
    setError(null);
    loadShareData();
  }, [isOpen, trip.id]);

  const loadShareData = async () => {
    setLoading(true);
    try {
      const [shareInfo, membersList] = await Promise.all([
        fetchTripShareInfo(trip.id),
        fetchTripMembers(trip.id),
      ]);
      setVisibility(shareInfo.visibility);
      setShareToken(shareInfo.share_token || null);
      setMembers(membersList);
    } catch (err: any) {
      console.error("Erro ao carregar dados de compartilhamento", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inviteUrl = shareToken
    ? `${window.location.origin}/?join=${shareToken}`
    : null;

  const handleToggleVisibility = async (newVis: "private" | "shared") => {
    if (!isOwnerOrAdmin) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateTripShareInfo(trip.id, newVis);
      setVisibility(res.visibility);
      setShareToken(res.share_token || null);
      if (onTripUpdated) {
        onTripUpdated({
          ...trip,
          visibility: res.visibility,
          share_token: res.share_token,
        });
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao atualizar visibilidade");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return { label: "Proprietário", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" };
      case "contributor":
        return { label: "Colaborador", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      default:
        return { label: "Visualizador", bg: "bg-slate-50 text-slate-700 border-slate-200" };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Compartilhar Viagem
              </h2>
              <p className="text-xs text-slate-500 line-clamp-1">{trip.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Visibility Options */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2.5">
              Privacidade da Viagem
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!isOwnerOrAdmin || saving}
                onClick={() => handleToggleVisibility("private")}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  visibility === "private"
                    ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                } ${!isOwnerOrAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-center gap-2">
                  <Lock className={`w-4 h-4 ${visibility === "private" ? "text-indigo-600" : "text-slate-500"}`} />
                  <span className="text-xs font-medium text-slate-900">Privada</span>
                </div>
                <span className="text-[11px] text-slate-500 leading-snug">
                  Apenas você e convidados têm acesso.
                </span>
              </button>

              <button
                type="button"
                disabled={!isOwnerOrAdmin || saving}
                onClick={() => handleToggleVisibility("shared")}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  visibility === "shared"
                    ? "border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                } ${!isOwnerOrAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-center gap-2">
                  <Globe2 className={`w-4 h-4 ${visibility === "shared" ? "text-emerald-600" : "text-slate-500"}`} />
                  <span className="text-xs font-medium text-slate-900">Compartilhada</span>
                </div>
                <span className="text-[11px] text-slate-500 leading-snug">
                  Quem tiver o link pode entrar e colaborar.
                </span>
              </button>
            </div>
            {!isOwnerOrAdmin && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                Apenas o proprietário ou administrador pode alterar a visibilidade desta viagem.
              </p>
            )}
          </div>

          {/* Invite Link */}
          {visibility === "shared" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Link de Convite para Colaboradores
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl || "Gerando link..."}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  disabled={!inviteUrl}
                  className={`px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Link
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Amigos e familiares que abrirem este link poderão fazer login com o Google e enviar suas fotos diretamente para esta viagem.
              </p>
            </div>
          )}

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Membros da Viagem ({members.length})
              </label>
            </div>

            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Carregando membros...
              </div>
            ) : members.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  Nenhum membro registrado ainda.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
                {members.map((m) => {
                  const roleInfo = getRoleLabel(m.role);
                  return (
                    <div
                      key={m.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {m.picture ? (
                          <img
                            src={m.picture}
                            alt={m.name}
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            {m.name}
                            {currentUser?.id === m.user_id && (
                              <span className="text-[10px] text-slate-400 ml-1.5 font-normal">
                                (Você)
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {m.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${roleInfo.bg}`}
                      >
                        {roleInfo.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
