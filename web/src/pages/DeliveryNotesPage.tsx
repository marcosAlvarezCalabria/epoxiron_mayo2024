import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  MinusIcon,
  PlusIcon
} from "@heroicons/react/24/outline";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  calculatePricePreview,
  createDeliveryNote,
  deleteDeliveryNote,
  getCustomers,
  getDeliveryNotes,
  updateDeliveryNote,
  updateDeliveryNoteStatus
} from "@/application/use-cases";
import { ApiErrorState } from "@/components/ApiErrorState";
import { RalColorPicker } from "@/components/RalColorPicker";
import type {
  DeliveryNote,
  DeliveryNoteInput,
  DeliveryNoteItemDraft,
  DeliveryNoteStatus
} from "@/domain/entities";
import { ApiError } from "@/infrastructure/api/apiClient";

interface DeliveryNoteItemFormState {
  description: string;
  color: string;
  linearMeters: string;
  squareMeters: string;
  thickness: string;
  quantity: string;
}

interface DeliveryNoteFormState {
  customerId: string;
  notes: string;
  date: string;
  items: DeliveryNoteItemFormState[];
}

interface PricePreviewState {
  unitPrice: number;
  totalPrice: number;
}

const badgeByStatus: Record<DeliveryNoteStatus, string> = {
  DRAFT: "text-gray-300 bg-white/5",
  PENDING: "text-amber-200 bg-amber-500/10 border border-amber-500/20",
  REVIEWED: "text-emerald-200 bg-emerald-500/10 border border-emerald-500/20"
};

const statusLabel: Record<DeliveryNoteStatus, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  REVIEWED: "Revisado"
};

const statusHelp: Record<DeliveryNoteStatus, string> = {
  DRAFT: "Todavia se esta preparando. Se puede editar y borrar.",
  PENDING: "Ya esta preparado, pero falta comprobarlo antes de darlo por bueno.",
  REVIEWED: "Ya esta revisado y validado para dejarlo cerrado."
};

const genericItemTemplates = [
  "Perfil rectangular",
  "Marco soldado",
  "Rejilla exterior",
  "Pletina mecanizada",
  "Bastidor auxiliar",
  "Caja de registro"
] as const;

const emptyItem = (): DeliveryNoteItemFormState => ({
  description: "",
  color: "RAL 7016",
  linearMeters: "",
  squareMeters: "",
  thickness: "",
  quantity: "1"
});

const emptyForm = (): DeliveryNoteFormState => ({
  customerId: "",
  notes: "",
  date: new Date().toISOString().slice(0, 10),
  items: [emptyItem()]
});

const noteToFormState = (note: DeliveryNote): DeliveryNoteFormState => ({
  customerId: note.customerId,
  notes: note.notes ?? "",
  date: note.date.slice(0, 10),
  items: note.items.map((item) => ({
    description: item.description,
    color: item.color,
    linearMeters: item.linearMeters?.toString() ?? "",
    squareMeters: item.squareMeters?.toString() ?? "",
    thickness: item.thickness?.toString() ?? "",
    quantity: item.quantity.toString()
  }))
});

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? Number.parseFloat(trimmed) : null;
};

const normalizeItem = (item: DeliveryNoteItemFormState): DeliveryNoteItemDraft => ({
  description: item.description.trim(),
  color: item.color.trim(),
  linearMeters: parseOptionalNumber(item.linearMeters),
  squareMeters: parseOptionalNumber(item.squareMeters),
  thickness: parseOptionalNumber(item.thickness),
  quantity: Number.parseInt(item.quantity || "1", 10)
});

const normalizePayload = (
  form: DeliveryNoteFormState,
  status: DeliveryNoteStatus
): DeliveryNoteInput => ({
  customerId: form.customerId,
  notes: form.notes.trim() ? form.notes.trim() : null,
  status,
  date: new Date(form.date).toISOString(),
  items: form.items.map(normalizeItem)
});

const canPreviewItem = (customerId: string, item: DeliveryNoteItemFormState) =>
  Boolean(
    customerId &&
      item.description.trim() &&
      item.color.trim() &&
      Number.parseInt(item.quantity || "0", 10) > 0
  );

const canAddAnotherPiece = (item: DeliveryNoteItemFormState) =>
  Boolean(item.description.trim() && item.color.trim());

export const DeliveryNotesPage = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [form, setForm] = useState<DeliveryNoteFormState>(emptyForm);
  const [customerSearch, setCustomerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeliveryNoteStatus | "ALL">("ALL");
  const [customerFilter, setCustomerFilter] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<number, PricePreviewState>>({});
  const [pendingScrollToItemIndex, setPendingScrollToItemIndex] = useState<number | null>(null);
  const [openTemplatePickerIndex, setOpenTemplatePickerIndex] = useState<number | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", "all-for-delivery-notes"],
    queryFn: () => getCustomers()
  });

  const deliveryNotesQuery = useQuery({
    queryKey: ["delivery-notes", statusFilter, customerFilter, todayOnly],
    queryFn: () =>
      getDeliveryNotes({
        status: statusFilter,
        customerId: customerFilter || undefined,
        today: todayOnly
      })
  });

  const selectedCustomer =
    customersQuery.data?.customers.find((customer) => customer.id === form.customerId) ?? null;
  const lastItem = form.items[form.items.length - 1];
  const canCreateAnotherPiece = !lastItem || canAddAnotherPiece(lastItem);

  const filteredCustomerSuggestions = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) {
      return [];
    }

    if (selectedCustomer && selectedCustomer.name.toLowerCase() === query) {
      return [];
    }

    return (customersQuery.data?.customers ?? [])
      .filter((customer) => customer.name.toLowerCase().startsWith(query))
      .slice(0, 8);
  }, [customerSearch, customersQuery.data?.customers, selectedCustomer]);

  const availableItemTemplates = useMemo(() => {
    const customerTemplates = selectedCustomer?.specialPieces.map((piece) => piece.name) ?? [];
    return [...new Set([...customerTemplates, ...genericItemTemplates])];
  }, [selectedCustomer]);

  const selectedNote =
    deliveryNotesQuery.data?.deliveryNotes.find((note) => note.id === selectedNoteId) ??
    deliveryNotesQuery.data?.deliveryNotes[0] ??
    null;
  const requestedNoteId = searchParams.get("noteId");

  useEffect(() => {
    if (!requestedNoteId || !deliveryNotesQuery.data?.deliveryNotes.length) {
      return;
    }

    const requestedNote = deliveryNotesQuery.data.deliveryNotes.find(
      (note) => note.id === requestedNoteId
    );

    if (!requestedNote) {
      return;
    }

    setSelectedNoteId(requestedNote.id);
    setMobilePane("detail");
  }, [deliveryNotesQuery.data?.deliveryNotes, requestedNoteId]);

  useEffect(() => {
    if (pendingScrollToItemIndex === null) {
      return;
    }

    const element = document.getElementById(`delivery-note-piece-${pendingScrollToItemIndex}`);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingScrollToItemIndex(null);
  }, [form.items.length, pendingScrollToItemIndex]);

  const createMutation = useMutation({
    mutationFn: createDeliveryNote,
    onSuccess: async (result) => {
      setEditingNoteId(null);
      setSelectedNoteId(result.deliveryNote.id);
      setForm(emptyForm());
      setCustomerSearch("");
      setFormError(null);
      setIsComposerOpen(false);
      setOpenTemplatePickerIndex(null);
      setPreviews({});
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DeliveryNoteInput }) =>
      updateDeliveryNote(id, input),
    onSuccess: async (result) => {
      setEditingNoteId(null);
      setSelectedNoteId(result.deliveryNote.id);
      setForm(emptyForm());
      setCustomerSearch("");
      setFormError(null);
      setIsComposerOpen(false);
      setOpenTemplatePickerIndex(null);
      setPreviews({});
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeliveryNote,
    onSuccess: async () => {
      setSelectedNoteId(null);
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryNoteStatus }) =>
      updateDeliveryNoteStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const mutationError = useMemo(() => {
    const error =
      createMutation.error ?? updateMutation.error ?? deleteMutation.error ?? statusMutation.error;
    return error instanceof ApiError ? error.message : null;
  }, [createMutation.error, deleteMutation.error, statusMutation.error, updateMutation.error]);

  const liveTotal = useMemo(
    () =>
      Object.values(previews).reduce((sum, preview) => sum + preview.totalPrice, 0),
    [previews]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!form.customerId) {
        startTransition(() => setPreviews({}));
        return;
      }

      const activeEntries = form.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => canPreviewItem(form.customerId, item));

      if (activeEntries.length === 0) {
        startTransition(() => setPreviews({}));
        return;
      }

      void Promise.all(
        activeEntries.map(async ({ item, index }) => {
          const result = await calculatePricePreview(form.customerId, normalizeItem(item));
          return { index, preview: result.pricing };
        })
      )
        .then((results) => {
          startTransition(() => {
            setPreviews(
              results.reduce<Record<number, PricePreviewState>>((accumulator, entry) => {
                accumulator[entry.index] = entry.preview;
                return accumulator;
              }, {})
            );
          });
        })
        .catch(() => {
          startTransition(() => setPreviews({}));
        });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [form]);

  const submitForm = async (status: DeliveryNoteStatus) => {
    setFormError(null);
    if (!form.customerId) {
      setFormError("Selecciona un cliente.");
      return;
    }
    if (form.items.some((item) => !item.description.trim() || !item.color.trim())) {
      setFormError("Todos los items deben tener descripcion y color.");
      return;
    }

    const payload = normalizePayload(form, status);
    try {
      if (editingNoteId) {
        await updateMutation.mutateAsync({ id: editingNoteId, input: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch {
      return;
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">Albaranes</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Cola de albaranes
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Gestion de trabajos con seleccion de cliente, calculo de precios y
            numeracion automatica.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50"
          onClick={() => {
            setEditingNoteId(null);
            setForm(emptyForm());
            setCustomerSearch("");
            setOpenTemplatePickerIndex(null);
            setPreviews({});
            setFormError(null);
            setMobilePane("detail");
            setIsComposerOpen(true);
          }}
          type="button"
        >
          <PlusIcon className="h-5 w-5" />
          Nuevo albaran
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div
          className={`order-2 space-y-4 xl:order-1 ${
            mobilePane === "detail" ? "hidden xl:block" : "block"
          }`}
        >
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {(["ALL", "DRAFT", "PENDING", "REVIEWED"] as const).map((value) => (
                  <button
                    className={`rounded-full px-3 py-2 text-sm font-semibold ${
                      statusFilter === value
                        ? "bg-cyan-500 text-gray-950"
                        : "border border-white/10 bg-gray-950/50 text-gray-300"
                    }`}
                    key={value}
                    onClick={() => setStatusFilter(value)}
                    type="button"
                  >
                    {value === "ALL" ? "Todos" : statusLabel[value]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${
                    todayOnly
                      ? "bg-amber-400 text-gray-950"
                      : "border border-white/10 bg-gray-950/50 text-gray-300"
                  }`}
                  onClick={() => setTodayOnly((current) => !current)}
                  type="button"
                >
                  Hoy
                </button>
                <select
                  className="w-full sm:w-auto sm:min-w-52 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
                  onChange={(event) => setCustomerFilter(event.target.value)}
                  value={customerFilter}
                >
                  <option value="">Todos los clientes</option>
                  {customersQuery.data?.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 border-t border-white/10 pt-3 text-sm text-slate-300">
                {customersQuery.error instanceof ApiError ? (
                  <ApiErrorState
                    message={customersQuery.error.message}
                    title="Error al cargar clientes"
                  />
                ) : null}

                <p className="font-semibold text-white">Como se usan los estados</p>
                <p>
                  <span className="font-semibold text-white">Borrador:</span> aun lo
                  estas preparando.
                </p>
                <p>
                  <span className="font-semibold text-white">Pendiente:</span> ya esta
                  hecho, pero falta revisarlo.
                </p>
                <p>
                  <span className="font-semibold text-white">Revisado:</span> ya esta
                  comprobado y cerrado.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {deliveryNotesQuery.error instanceof ApiError ? (
              <ApiErrorState
                message={deliveryNotesQuery.error.message}
                title="Error al cargar albaranes"
              />
            ) : null}

            {deliveryNotesQuery.data?.deliveryNotes.length ? (
              deliveryNotesQuery.data.deliveryNotes.map((note) => (
                <button
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    selectedNote?.id === note.id
                      ? "border-cyan-400/30 bg-cyan-400/10"
                      : "border-white/10 bg-slate-900/70 hover:border-white/20"
                  }`}
                  key={note.id}
                  onClick={() => {
                    setSelectedNoteId(note.id);
                    setMobilePane("detail");
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">
                        {note.number}
                      </p>
                      <p className="mt-1 text-sm text-gray-400">{note.customerName}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeByStatus[note.status]}`}>
                      {statusLabel[note.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {note.items.length} lineas · {new Date(note.date).toLocaleDateString("es-ES")}
                    </span>
                    <span className="font-mono text-cyan-300">
                      {note.totalAmount.toFixed(2)} €
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-8 text-sm text-gray-500">
                No hay albaranes para este filtro.
              </div>
            )}
          </div>
        </div>

        <div
          className={`order-1 space-y-4 xl:order-2 ${
            mobilePane === "list" ? "hidden xl:block" : "block"
          }`}
        >
          {selectedNote ? (
            <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <button
                className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white xl:hidden"
                onClick={() => setMobilePane("list")}
                type="button"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Volver a la lista
              </button>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Albaran seleccionado</p>
                  <h3 className="mt-1 text-2xl font-semibold text-white">
                    {selectedNote.number}
                  </h3>
                  <p className="mt-2 text-sm text-gray-400">
                    {selectedNote.customerName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => {
                      setEditingNoteId(selectedNote.id);
                      setForm(noteToFormState(selectedNote));
                      setCustomerSearch(selectedNote.customerName);
                      setFormError(null);
                      setOpenTemplatePickerIndex(null);
                      setPreviews({});
                      setIsComposerOpen(true);
                    }}
                    type="button"
                  >
                    Editar
                  </button>
                  {selectedNote.status !== "REVIEWED" ? (
                    <button
                      className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200"
                      onClick={() =>
                        statusMutation.mutate({ id: selectedNote.id, status: "REVIEWED" })
                      }
                      type="button"
                    >
                      Revisado
                    </button>
                  ) : null}
                  {selectedNote.status === "DRAFT" ? (
                    <button
                      className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200"
                      onClick={() => {
                        if (window.confirm(`Eliminar albaran ${selectedNote.number}?`)) {
                          deleteMutation.mutate(selectedNote.id);
                        }
                      }}
                      type="button"
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-gray-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Estado
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {statusLabel[selectedNote.status]}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {statusHelp[selectedNote.status]}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-gray-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Fecha
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {new Date(selectedNote.date).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                    Total
                  </p>
                  <p className="mt-2 text-xl font-bold text-cyan-100">
                    {selectedNote.totalAmount.toFixed(2)} €
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {selectedNote.items.map((item, index) => (
                  <div
                    className="rounded-2xl border border-white/10 bg-gray-950/50 p-4"
                    key={`${selectedNote.id}-${index}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.description}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          {item.color} · x{item.quantity}
                        </p>
                      </div>
                      <span className="font-mono text-sm text-cyan-300">
                        {item.totalPrice.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {isComposerOpen ? (
            <div className="fixed inset-0 z-40 bg-gray-950/75 backdrop-blur sm:flex sm:items-center sm:justify-center">
              <button
                aria-label="Cerrar formulario de albaran"
                className="absolute inset-0"
                onClick={() => {
                  setEditingNoteId(null);
                  setForm(emptyForm());
                  setCustomerSearch("");
                  setPreviews({});
                  setFormError(null);
                  setIsComposerOpen(false);
                }}
                type="button"
              />
            <form
              className="absolute inset-0 z-10 flex h-full w-full flex-col bg-[#0b1220] shadow-2xl shadow-cyan-950/40 sm:relative sm:inset-auto sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-[2rem] sm:border sm:border-white/10"
              onSubmit={(event) => {
                event.preventDefault();
                void submitForm(editingNoteId ? "PENDING" : "DRAFT");
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1220] px-4 pb-2 pt-1.5 sm:px-5 sm:pb-3 sm:pt-2">
                <h3 className="text-lg font-bold text-white">
                  {editingNoteId ? "Editar albaran" : "Nuevo albaran"}
                </h3>
                <button
                  className="rounded-2xl border border-white/10 px-3 py-1 text-sm text-gray-300"
                  onClick={() => {
                    setEditingNoteId(null);
                    setForm(emptyForm());
                    setCustomerSearch("");
                    setOpenTemplatePickerIndex(null);
                    setPreviews({});
                    setFormError(null);
                    setIsComposerOpen(false);
                  }}
                  type="button"
                >
                  Cerrar
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="rounded-2xl border border-white/10 bg-gray-950/50 px-4 py-3">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Fecha
                  </span>
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="h-5 w-5 text-cyan-300" />
                    <input
                      className="w-full bg-transparent text-sm text-white outline-none"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, date: event.target.value }))
                      }
                      type="date"
                      value={form.date}
                    />
                  </div>
                </label>
                <div className="rounded-2xl border border-dashed border-white/10 bg-gray-950/40 px-4 py-3 text-sm text-gray-400">
                  Numero asignado al guardar:
                  <div className="mt-2 font-mono text-cyan-200">ALB-YYYY-NNNN</div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                  Cliente
                </p>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                  onChange={(event) => {
                    setCustomerSearch(event.target.value);
                    setForm((current) => ({ ...current, customerId: "" }));
                  }}
                  placeholder="Escribe la primera letra del cliente"
                  value={customerSearch}
                />

                {filteredCustomerSuggestions.length ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-gray-950/75">
                    {filteredCustomerSuggestions.map((customer) => (
                      <button
                        className="flex w-full items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left text-sm text-white last:border-b-0 hover:bg-white/5"
                        key={customer.id}
                        onClick={() => {
                          setForm((current) => ({ ...current, customerId: customer.id }));
                          setCustomerSearch(customer.name);
                        }}
                        type="button"
                      >
                        <span className="font-medium">{customer.name}</span>
                        <span className="text-xs text-gray-500">
                          {customer.specialPieces.length} piezas
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

              </div>

              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-gray-500"
                    disabled={!canCreateAnotherPiece}
                    onClick={() => {
                      if (!canCreateAnotherPiece) {
                        return;
                      }

                      setForm((current) => {
                        const nextIndex = current.items.length;
                        setPendingScrollToItemIndex(nextIndex);
                        return {
                          ...current,
                          items: [...current.items, emptyItem()]
                        };
                      });
                    }}
                    type="button"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Pieza
                  </button>
                </div>

                {!canCreateAnotherPiece ? (
                  <p className="text-sm text-amber-300">
                    Completa la ultima pieza antes de añadir otra.
                  </p>
                ) : null}

                {form.items.map((item, index) => (
                  <div
                    className="space-y-4 rounded-3xl border border-white/10 bg-gray-950/50 p-4"
                    id={`delivery-note-piece-${index}`}
                    key={`item-${index}`}
                  >
                    {availableItemTemplates.length ? (
                      <div className="space-y-3">
                        <button
                          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-left text-sm font-semibold text-white"
                          onClick={() =>
                            setOpenTemplatePickerIndex((current) =>
                              current === index ? null : index
                            )
                          }
                          type="button"
                        >
                          <span>Piezas especiales</span>
                          <ChevronDownIcon
                            className={`h-4 w-4 transition-transform ${
                              openTemplatePickerIndex === index ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {openTemplatePickerIndex === index ? (
                          <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-950/50">
                            {availableItemTemplates.map((template) => (
                              <button
                                className={`flex w-full items-center justify-between border-b border-white/10 px-4 py-3 text-left text-sm last:border-b-0 ${
                                  item.description === template
                                    ? "bg-cyan-500/15 text-cyan-100"
                                    : "text-gray-200 hover:bg-white/5"
                                }`}
                                key={`${index}-${template}`}
                                onClick={() => {
                                  setForm((current) => ({
                                    ...current,
                                    items: current.items.map((entry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...entry, description: template }
                                        : entry
                                    )
                                  }));
                                  setOpenTemplatePickerIndex(null);
                                }}
                                type="button"
                              >
                                <span>{template}</span>
                                {item.description === template ? (
                                  <span className="text-xs font-semibold text-cyan-200">
                                    Seleccionada
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <input
                      className="w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, description: event.target.value }
                              : entry
                          )
                        }))
                      }
                      placeholder="Descripcion"
                      value={item.description}
                    />

                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                        Color
                      </p>
                      <RalColorPicker
                        onChange={(color) =>
                          setForm((current) => ({
                            ...current,
                            items: current.items.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, color } : entry
                            )
                          }))
                        }
                        value={item.color}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[132px_1fr_1fr_1fr]">
                      <div className="rounded-2xl border border-white/10 bg-gray-950/60 p-2">
                        <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                          Cantidad
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            className="rounded-xl border border-white/10 p-2 text-gray-300"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                items: current.items.map((entry, entryIndex) => {
                                  if (entryIndex !== index) {
                                    return entry;
                                  }
                                  const next = Math.max(
                                    1,
                                    Number.parseInt(entry.quantity || "1", 10) - 1
                                  );
                                  return { ...entry, quantity: next.toString() };
                                })
                              }))
                            }
                            type="button"
                          >
                            <MinusIcon className="h-4 w-4" />
                          </button>
                          <span className="text-lg font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            className="rounded-xl border border-white/10 p-2 text-gray-300"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                items: current.items.map((entry, entryIndex) => {
                                  if (entryIndex !== index) {
                                    return entry;
                                  }
                                  const next =
                                    Number.parseInt(entry.quantity || "1", 10) + 1;
                                  return { ...entry, quantity: next.toString() };
                                })
                              }))
                            }
                            type="button"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {([
                        { key: "linearMeters", label: "ML" },
                        { key: "squareMeters", label: "M2" },
                        { key: "thickness", label: "Grosor" }
                      ] as const).map((field) => (
                        <label
                          className="rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3"
                          key={`${index}-${field.key}`}
                        >
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                            {field.label}
                          </span>
                          <input
                            className="mt-2 w-full bg-transparent text-sm text-white outline-none"
                            inputMode="decimal"
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                items: current.items.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, [field.key]: event.target.value }
                                    : entry
                                )
                              }))
                            }
                            placeholder="0"
                            value={item[field.key]}
                          />
                        </label>
                      ))}
                    </div>

                    <p className="text-xs text-gray-500">
                      Puedes rellenar metros lineales, metros cuadrados o ambos.
                    </p>

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-cyan-100">
                          {previews[index]
                            ? `Total pieza ${previews[index].totalPrice.toFixed(2)} €`
                            : "Completa cliente, descripcion y color para ver precio"}
                        </p>
                        {previews[index] ? (
                          <p className="mt-1 text-cyan-200/80">
                            Unitario {previews[index].unitPrice.toFixed(2)} €
                          </p>
                        ) : null}
                      </div>
                      {form.items.length > 1 ? (
                        <button
                          className="rounded-2xl border border-white/10 px-3 py-2 text-gray-200"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.filter((_, entryIndex) => entryIndex !== index)
                            }))
                          }
                          type="button"
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <textarea
                className="min-h-24 w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Notas del trabajo"
                value={form.notes}
              />

              {formError || mutationError ? (
                <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {formError ?? mutationError}
                </p>
              ) : null}
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 bg-[#0b1220] px-4 py-2 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Resumen
                  </p>
                  <p className="text-base font-bold text-cyan-200">
                    {liveTotal.toFixed(2)} €
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => void submitForm("DRAFT")}
                    type="button"
                  >
                    Borrador
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-gray-950"
                    onClick={() => void submitForm("PENDING")}
                    type="button"
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    Pendiente
                  </button>
                </div>
              </div>
            </form>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 p-8 text-sm text-gray-500">
              Selecciona un albaran o crea uno nuevo para ver su detalle.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

