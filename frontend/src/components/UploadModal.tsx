import React, { useState } from "react";
import {
  CheckCircle2,
  Compass,
  FolderSync,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  clearAllMedia,
  pollScanStatus,
  triggerFolderScan,
  uploadFiles,
} from "../api/client";
import { ScanStatus, Trip } from "../types";

interface UploadModalProps {
  isOpen: boolean;
  trips: Trip[];
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  trips,
  onClose,
  onSuccess,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [scanJob, setScanJob] = useState<ScanStatus | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Target Trip assignment during import
  const [targetTripId, setTargetTripId] = useState<string>("");
  const [newTripName, setNewTripName] = useState<string>("");
  const [groupBySubfolder, setGroupBySubfolder] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleClearLibrary = async () => {
    if (
      !window.confirm(
        "Deseja realmente remover todas as fotos atuais do banco de dados para começar do zero?"
      )
    ) {
      return;
    }
    setIsClearing(true);
    setStatusMsg("Limpando biblioteca...");
    try {
      await clearAllMedia();
      setScanJob(null);
      setStatusMsg("Biblioteca limpa! Agora você pode importar suas fotos.");
      onSuccess();
    } catch (err: any) {
      setStatusMsg(err.message || "Erro ao limpar biblioteca");
    } finally {
      setIsClearing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    setStatusMsg(`Enviando e processando ${e.target.files.length} arquivo(s)...`);
    try {
      const uploaded = await uploadFiles(e.target.files, {
        tripId: targetTripId || undefined,
        tripName: newTripName.trim() || undefined,
      });
      setStatusMsg(`${uploaded.length} mídia(s) processada(s) com sucesso!`);
      onSuccess();
    } catch (err: any) {
      setStatusMsg(err.message || "Erro ao enviar arquivos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartFolderScan = async () => {
    setStatusMsg(null);
    const job = await triggerFolderScan({
      tripId: targetTripId || undefined,
      tripName: newTripName.trim() || undefined,
      groupBySubfolder,
    });
    setScanJob(job);

    const interval = setInterval(async () => {
      try {
        const updated = await pollScanStatus(job.id);
        setScanJob(updated);
        if (updated.status !== "running") {
          clearInterval(interval);
          onSuccess();
        }
      } catch {
        clearInterval(interval);
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Importar Fotos e Vídeos
            </h2>
            <p className="text-xs text-slate-500">
              Suporte completo a iPhone 16 Plus (HEIC/MOV) e Samsung Galaxy S25 (JPEG/HEIC/MP4).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Trip Assignment on Import */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Compass className="w-4 h-4 text-blue-600" />
              <span>Agrupar em uma Viagem ao importar (Opcional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={targetTripId}
                onChange={(e) => {
                  setTargetTripId(e.target.value);
                  if (e.target.value) setNewTripName("");
                }}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Detectar automaticamente (GPS/Data)</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    Viagem: {t.title}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={newTripName}
                onChange={(e) => {
                  setNewTripName(e.target.value);
                  if (e.target.value) setTargetTripId("");
                }}
                placeholder="Ou digite nova viagem (ex: Bahia 2026)"
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={groupBySubfolder}
                onChange={(e) => setGroupBySubfolder(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                No scanner da pasta <code className="bg-slate-200 px-1 rounded">/import</code>, usar o nome de cada subpasta como nome da Viagem
              </span>
            </label>
          </div>

          {/* Option 1: Browser Drag & Drop Upload */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl p-5 cursor-pointer bg-slate-50/70 hover:bg-blue-50/30 transition-colors text-center">
            <UploadCloud className="w-9 h-9 text-blue-600 mb-1.5" />
            <span className="text-sm font-semibold text-slate-800">
              Selecionar fotos ou vídeos pelo navegador
            </span>
            <span className="text-xs text-slate-500 mt-0.5">
              Extrai GPS/EXIF, gera miniaturas WebP no RustFS (S3) e detecta rostos
            </span>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov"
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
          </label>

          {/* Option 2: Local Folder Scanner */}
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">
                Escanear Pasta Local (<code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded">/import</code>)
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Importa em lote (ou re-associa à viagem escolhida acima) ignorando fotos excluídas.
              </p>
            </div>
            <button
              onClick={handleStartFolderScan}
              disabled={scanJob?.status === "running"}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 shrink-0"
            >
              {scanJob?.status === "running" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderSync className="w-4 h-4" />
              )}
              <span>Escanear Pasta</span>
            </button>
          </div>

          {/* Progress / Status feedback */}
          {(statusMsg || scanJob) && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 flex items-start gap-2.5">
              {isUploading || isClearing || scanJob?.status === "running" ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                {statusMsg && <p className="font-medium">{statusMsg}</p>}
                {scanJob && (
                  <p>
                    {scanJob.message} ({scanJob.processed_files}/{scanJob.total_files} arquivos)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Option 3: Clear Demo / Reset Library */}
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500">
              Quer apagar todos os dados e começar com o banco limpo?
            </span>
            <button
              type="button"
              onClick={handleClearLibrary}
              disabled={isClearing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Biblioteca</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
