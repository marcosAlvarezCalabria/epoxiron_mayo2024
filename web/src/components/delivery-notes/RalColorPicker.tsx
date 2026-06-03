import { CheckIcon, MagnifyingGlassIcon, SwatchIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import {
  getRalColor,
  RAL_COLORS,
  RAL_FAMILY_ORDER
} from "@/constants/ralColors";

interface RalColorPickerProps {
  onChange: (ral: string) => void;
  value: string;
}

const groupedEntries = RAL_FAMILY_ORDER.map((family) => ({
  family,
  colors: Object.entries(RAL_COLORS)
    .filter(([, color]) => color.family === family)
    .sort(([left], [right]) => left.localeCompare(right))
}));

export const RalColorPicker = ({ onChange, value }: RalColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = getRalColor(value);

  const visibleGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return groupedEntries;
    }

    return groupedEntries
      .map((group) => ({
        ...group,
        colors: group.colors.filter(([code, color]) =>
          `${code} ${color.name} ${color.family}`.toLowerCase().includes(query)
        )
      }))
      .filter((group) => group.colors.length > 0);
  }, [search]);

  const close = () => {
    setIsOpen(false);
    setSearch("");
  };

  return (
    <>
      <button
        className="flex w-full items-center justify-between gap-3 border border-neutral-300 bg-white px-4 py-3 text-left text-neutral-900"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Color RAL
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="h-9 w-9 shrink-0 border border-white/10"
              style={{ backgroundColor: selected?.hex ?? "#111111" }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {value}
              </p>
              <p className="truncate text-xs text-neutral-500">
                {selected ? selected.name : "Selecciona un acabado"}
              </p>
            </div>
          </div>
        </div>
        <SwatchIcon className="h-5 w-5 shrink-0 text-[var(--epx-accent)]" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-[color:rgb(19_19_19_/_0.82)] backdrop-blur-sm">
          <button
            aria-label="Cerrar selector RAL"
            className="absolute inset-0"
            onClick={close}
            type="button"
          />

          <div className="absolute inset-x-0 bottom-0 top-10 flex flex-col border border-neutral-300 bg-white sm:inset-10">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-300 px-4 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                  RAL seleccionado
                </p>
                <h3 className="mt-2 text-lg font-semibold text-neutral-900">
                  {selected ? `${value} - ${selected.name}` : value}
                </h3>
              </div>
              <button
                className="border border-neutral-300 bg-white px-3 py-2 text-neutral-600"
                onClick={close}
                type="button"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-neutral-300 px-4 py-3 sm:px-6">
              <label className="flex items-center gap-3 border border-neutral-300 bg-white px-4 py-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-neutral-500" />
                <input
                  className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por codigo, familia o nombre"
                  value={search}
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-6">
                {visibleGroups.map((group) => (
                  <section className="space-y-3" key={group.family}>
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                      {group.family}
                    </h4>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                      {group.colors.map(([code, color]) => {
                        const isSelected = value === code;
                        return (
                          <button
                            aria-label={`${code} ${color.name}`}
                            className={`relative h-9 w-9 border transition-transform hover:scale-[1.03] ${
                              isSelected
                                ? "border-[var(--epx-accent)] ring-2 ring-[var(--epx-accent)]/40"
                                : "border-neutral-300"
                            }`}
                            key={code}
                            onClick={() => {
                              onChange(code);
                              close();
                            }}
                            style={{ backgroundColor: color.hex }}
                            title={`${code} - ${color.name}`}
                            type="button"
                          >
                            {isSelected ? (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                                <CheckIcon className="h-4 w-4" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
