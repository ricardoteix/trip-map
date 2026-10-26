import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Cloud,
  Folder,
  HardDriveDownload,
  Loader2,
  LogIn,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  disconnectGoogleAccount,
  fetchDriveFolders,
  fetchGoogleAccounts,
  fetchGoogleAuthUrl,
  pollScanStatus,
  triggerDriveFolderSync,
} from "../api/client";
import { GoogleAccount, GoogleDriveFolderItem, ScanStatus, Trip } from "../types";

interface GoogleDriveModalProps {
  isOpen: boolean;
  trips: Trip[];
  onClose: () => void;
  onSuccess: () => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  trips,
  onClose,
  onSuccess,
}) => {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [folders, setFolders] = useState<GoogleDriveFolderItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");

  const [targetTripId, setTargetTripId] = useState<string>("");
  const [newTripName, setNewTripName] = useState<string>("");

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [syncJob, setSyncJob] = useState<ScanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setError(null);
    try {
      const accs = await fetchGoogleAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar contas do Google.");
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedAccountId) {
      setFolders([]);
      return;
    }
    const loadFolders = async () => {
      setLoadingFolders(true);
      setError(null);
      try {
        const items = await fetchDriveFolders(selectedAccountId);
        setFolders(items);
        if (items.length > 0) {
          setSelectedFolderId(items[0].id);
        } else {
          setSelectedFolderId("");
        }
      } catch (err: any) {
        setError(err?.message || "Erro ao listar pastas do Google Drive.");
      } finally {
        setLoadingFolders(false);
      }
    };
    loadFolders();
  }, [selectedAccountId]);

  // Poll sync status if active
  useEffect(() => {
    if (!syncJob || syncJob.status !== "running") return;
    const interval = setInterval(async () => {
      try {
        const updated = await pollScanStatus(syncJob.id);
        setSyncJob(updated);
        if (updated.status === "completed") {
          clearInterval(interval);
          onSuccess();
        } else if (updated.status === "failed") {
          clearInterval(interval);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [syncJob, onSuccess]);

  if (!isOpen) return null;

  const handleConnectAccount = async () => {
    setError(null);
    try {
      const url = await fetchGoogleAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || "Erro ao iniciar autenticação do Google.");
    }
  };

  const handleDisconnect = async (accId: string) => {
    if (!window.confirm("Desconectar esta conta Google do TripMap?")) return;
    try {
      await disconnectGoogleAccount(accId);
      if (selectedAccountId === accId) {
        setSelectedAccountId("");
      }
      await loadAccounts();
    } catch (err: any) {
      setError(err?.message || "Erro ao desconectar conta.");
    }
  };

  const handleStartSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !selectedFolderId) return;

    const folderName = folders.find((f) => f.id === selectedFolderId)?.name;
    setError(null);
    try {
      const job = await triggerDriveFolderSync({
        accountId: selectedAccountId,
        folderId: selectedFolderId,
        folderName,
        tripId: targetTripId || undefined,
        tripName: newTripName.trim() || undefined,
      });
      setSyncJob(job);
    } catch (err: any) {
      setError(err?.message || "Erro ao iniciar importação da pasta do Google Drive.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Importar do Google Drive
              </h2>
              <p className="text-xs text-slate-500">
                Puxe fotos do Drive sem ocupar espaço local de arquivos originais
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Connected Accounts */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Contas Google Conectadas
              </label>
              <button
                type="button"
                onClick={handleConnectAccount}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>+ Conectar Conta Google</span>
              </button>
            </div>

            {loadingAccounts ? (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Carregando contas...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  Nenhuma conta do Google conectada ainda.
                </p>
                <button
                  onClick={handleConnectAccount}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
                  Conectar meu Google Drive
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      selectedAccountId === acc.id
                        ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/20"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {acc.picture ? (
                        <img
                          src={acc.picture}
                          alt={acc.name || acc.email}
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {acc.email[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {acc.name || acc.email}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{acc.email}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDisconnect(acc.id);
                      }}
                      title="Desconectar conta"
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Choose Folder & Destination Trip */}
          {accounts.length > 0 && (
            <form onSubmit={handleStartSync} className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Pasta do Google Drive a Importar</span>
                  {selectedAccountId && (
                    <button
                      type="button"
                      onClick={() => {
                        const accId = selectedAccountId;
                        setSelectedAccountId("");
                        setTimeout(() => setSelectedAccountId(accId), 50);
                      }}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Atualizar pastas</span>
                    </button>
                  )}
                </label>

                {loadingFolders ? (
                  <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Buscando pastas no Google Drive...</span>
                  </div>
                ) : folders.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Nenhuma pasta encontrada nesta conta do Google Drive.
                  </p>
                ) : (
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
                  >
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Destination Trip */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Vincular a uma Viagem (Opcional)
                </label>
                {trips.length > 0 && (
                  <select
                    value={targetTripId}
                    onChange={(e) => {
                      setTargetTripId(e.target.value);
                      if (e.target.value) setNewTripName("");
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500 mb-2"
                  >
                    <option value="">-- Selecionar viagem existente --</option>
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.media_count} fotos)
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="text"
                  value={newTripName}
                  onChange={(e) => {
                    setNewTripName(e.target.value);
                    if (e.target.value) setTargetTripId("");
                  }}
                  placeholder="Ou criar nova viagem (ex: Chapada Diamantina)..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Zero-Disk Storage callout */}
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                <HardDriveDownload className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Economia Máxima de Disco:</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    O TripMap extrai GPS e gera apenas miniaturas WebP leves (~150 KB por foto).
                    Os arquivos originais brutos permanecem seguros no seu Google Drive,
                    ocupando <strong>zero bytes</strong> de fotos originais no servidor!
                  </p>
                </div>
              </div>

              {/* Progress feedback */}
              {syncJob && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1.5">
                  <div className="flex items-center justify-between font-semibold">
                    <span>
                      {syncJob.status === "running" && "Importando do Google Drive..."}
                      {syncJob.status === "completed" && "Importação Concluída!"}
                      {syncJob.status === "failed" && "Falha na Importação"}
                    </span>
                    <span>
                      {syncJob.processed_files} / {syncJob.total_files}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700">{syncJob.message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedFolderId || syncJob?.status === "running"}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-colors"
              >
                {syncJob?.status === "running" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importando fotos...</span>
                  </>
                ) : (
                  <>
                    <Folder className="w-4 h-4" />
                    <span>Iniciar Importação da Pasta</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
