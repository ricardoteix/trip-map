import React, { useState } from "react";
import { Check, GitMerge, Pencil, Trash2, Users, X } from "lucide-react";
import { Person } from "../types";

interface PeopleModalProps {
  isOpen: boolean;
  people: Person[];
  onClose: () => void;
  onRename: (personId: string, newName: string) => Promise<void>;
  onMerge: (sourceId: string, targetId: string) => Promise<void>;
  onDelete: (person: Person) => Promise<void>;
}

export const PeopleModal: React.FC<PeopleModalProps> = ({
  isOpen,
  people,
  onClose,
  onRename,
  onMerge,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>("");
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const startEdit = (p: Person) => {
    setEditingId(p.id);
    setNameInput(p.name);
  };

  const submitRename = async (personId: string) => {
    if (!nameInput.trim()) return;
    setBusy(true);
    try {
      await onRename(personId, nameInput.trim());
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const handleMergeClick = async (personId: string) => {
    if (!mergeSourceId) {
      setMergeSourceId(personId);
      return;
    }
    if (mergeSourceId === personId) {
      setMergeSourceId(null);
      return;
    }
    setBusy(true);
    try {
      await onMerge(mergeSourceId, personId);
      setMergeSourceId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Pessoas Identificadas & Grupos de Rostos
              </h2>
              <p className="text-xs text-slate-500">
                Dê nome aos grupos detectados ou mescle dois grupos da mesma pessoa.
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

        {mergeSourceId && (
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-2.5 flex items-center justify-between text-xs text-blue-800">
            <span>
              Modo de mesclagem ativo: clique agora na pessoa de <strong>destino</strong> para unir as fotos.
            </span>
            <button
              onClick={() => setMergeSourceId(null)}
              className="font-semibold underline hover:text-blue-950"
            >
              Cancelar
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {people.map((person) => {
            const isEditing = editingId === person.id;
            const isMergeSource = mergeSourceId === person.id;

            return (
              <div
                key={person.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isMergeSource
                    ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
                    : "border-slate-200 bg-slate-50/60 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 ring-2 ring-white shadow-xs shrink-0">
                    {person.avatar_url ? (
                      <img
                        src={person.avatar_url}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-slate-600">
                        {person.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitRename(person.id)}
                        autoFocus
                        placeholder="Nome da pessoa..."
                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-blue-400 focus:outline-none bg-white"
                      />
                      <button
                        disabled={busy}
                        onClick={() => submitRename(person.id)}
                        className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {person.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {person.photo_count} {person.photo_count === 1 ? "foto" : "fotos"}
                      </p>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => startEdit(person)}
                      title="Renomear pessoa"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMergeClick(person.id)}
                      title={
                        mergeSourceId
                          ? "Mesclar com esta pessoa"
                          : "Mesclar este grupo com outra pessoa"
                      }
                      className={`p-1.5 rounded-lg transition-colors ${
                        isMergeSource
                          ? "bg-blue-600 text-white"
                          : mergeSourceId
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                      }`}
                    >
                      <GitMerge className="w-4 h-4" />
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => onDelete(person)}
                      title="Não é uma pessoa / Descartar este rosto (as fotos da viagem são mantidas)"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
