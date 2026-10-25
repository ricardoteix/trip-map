import React, { useRef, useState } from "react";
import {
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileJson,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { BackupImportResult, importCurationBackup } from "../api/client";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BackupImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    window.location.href = "/api/backup/export";
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await importCurationBackup(selectedFile);
      setResult(res);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "Erro ao importar o arquivo de backup");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DatabaseBackup className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Backup & Migração de Curadoria
              </h2>
              <p className="text-xs text-slate-500">
                Exporte suas viagens, passeios, pessoas e locais para levar ao servidor
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

        <div className="p-6 space-y-5">
          {/* Card 1: Export */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Exportar desta máquina
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Gera um arquivo portátil (<code>.json</code>) com todas as suas{" "}
                <strong>Viagens</strong>, <strong>Passeios & Locais</strong> (ex:{" "}
                <em>Cachoeira do Buracão • Ibicoara-BA</em>),{" "}
                <strong>Pessoas nomeadas</strong> (com avatares e inteligência facial),{" "}
                <strong>coordenadas GPS manuais</strong> e a{" "}
                <strong>lista de fotos excluídas</strong> vinculadas pelo hash{" "}
                <code>SHA-256</code> de cada foto.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Curadoria (.json)</span>
            </button>
          </div>

          {/* Card 2: Import */}
          <form
            onSubmit={handleImport}
            className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
          >
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                2. Importar no servidor (ou restaurar backup)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Funciona tanto <strong>antes</strong> quanto <strong>depois</strong> de
                escanear a pasta <code>/import</code> no servidor: aplica os nomes,
                viagens, passeios e pessoas nas fotos já escaneadas e memoriza as regras
                para o próximo escaneamento (além de pular fotos excluídas).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 cursor-pointer text-xs text-slate-600 truncate">
                <FileJson className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">
                  {selectedFile
                    ? selectedFile.name
                    : "Selecionar arquivo tripmap-curation-backup.json..."}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={!selectedFile || importing}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Restaurar Backup</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            {result && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Curadoria restaurada com sucesso!</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  • <strong>{result.trips_restored}</strong> viagem(ns) e{" "}
                  <strong>{result.outings_restored}</strong> passeio(s)/local(is) •{" "}
                  <strong>{result.people_restored}</strong> pessoa(s) com perfil facial •{" "}
                  <strong>{result.media_updated_now}</strong> foto(s) atualizada(s) agora (e{" "}
                  <strong>{result.media_cached_for_scan}</strong> memorizada(s) para o
                  escaneamento da pasta <code>/import</code>).
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
