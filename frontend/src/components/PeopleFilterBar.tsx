import React from "react";
import { Check, Settings2, Users, X } from "lucide-react";
import { Person } from "../types";

interface PeopleFilterBarProps {
  people: Person[];
  selectedIds: string[];
  peopleMode: "AND" | "OR";
  onTogglePerson: (personId: string) => void;
  onChangeMode: (mode: "AND" | "OR") => void;
  onClearPeople: () => void;
  onOpenManageModal: () => void;
}

export const PeopleFilterBar: React.FC<PeopleFilterBarProps> = ({
  people,
  selectedIds,
  peopleMode,
  onTogglePerson,
  onChangeMode,
  onClearPeople,
  onOpenManageModal,
}) => {
  return (
    <div className="bg-white border-b border-slate-200/80 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 shrink-0 mr-1">
          <Users className="w-4 h-4 text-blue-600" />
          <span>Fotos com:</span>
        </div>

        {/* Person Avatar Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {people.map((person) => {
            const isSelected = selectedIds.includes(person.id);
            return (
              <button
                key={person.id}
                onClick={() => onTogglePerson(person.id)}
                className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-medium border transition-all shrink-0 ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className="relative w-5 h-5 rounded-full overflow-hidden bg-slate-200 shrink-0">
                  {person.avatar_url ? (
                    <img
                      src={person.avatar_url}
                      alt={person.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-[10px] font-bold">
                      {person.name.charAt(0)}
                    </span>
                  )}
                  {isSelected && (
                    <span className="absolute inset-0 bg-blue-600/40 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white stroke-[3]" />
                    </span>
                  )}
                </div>
                <span>{person.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-blue-700 text-blue-100" : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  {person.photo_count}
                </span>
              </button>
            );
          })}
        </div>

        {selectedIds.length > 0 && (
          <button
            onClick={onClearPeople}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        )}
      </div>

      {/* Boolean AND / OR Toggle & Manage People Button */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200"
          title="Defina se as fotos devem conter TODAS as pessoas selecionadas juntas (AND) ou QUALQUER uma delas (OR)"
        >
          <button
            onClick={() => onChangeMode("AND")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              peopleMode === "AND"
                ? "bg-white text-blue-600 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Todos juntos (E)
          </button>
          <button
            onClick={() => onChangeMode("OR")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              peopleMode === "OR"
                ? "bg-white text-blue-600 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Qualquer um (OU)
          </button>
        </div>

        <button
          onClick={onOpenManageModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Nomear / Agrupar Rostos</span>
        </button>
      </div>
    </div>
  );
};
