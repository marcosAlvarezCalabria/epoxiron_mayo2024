import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  MinusIcon,
  PlusIcon
} from "@heroicons/react/24/outline";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
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
  hasThickness: boolean;
  hasPrimer: boolean;
  saveAsSpecialPiece: boolean;
  description: string;
  color: string;
  linearMeters: string;
  squareMeters: string;
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

interface DeliveryNoteItemFieldErrors {
  color?: string;
  description?: string;
}

const badgeByStatus: Record<DeliveryNoteStatus, string> = {
  DRAFT: "text-[var(--epx-text-muted)] bg-[var(--epx-surface)] border border-[var(--epx-surface-raised)]",
  PENDING:
    "text-[var(--epx-accent)] bg-[color:rgb(255_149_0_/_0.12)] border border-[var(--epx-accent)]/30",
  REVIEWED:
    "text-[var(--epx-success)] bg-[color:rgb(209_255_0_/_0.12)] border border-[var(--epx-success)]/30"
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

const emptyItem = (): DeliveryNoteItemFormState => ({
  hasThickness: false,
  hasPrimer: false,
  saveAsSpecialPiece: false,
  description: "",
  color: "RAL 7016",
  linearMeters: "",
  squareMeters: "",
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
    hasThickness: item.thickness != null,
    hasPrimer: item.primer ?? false,
    saveAsSpecialPiece: false,
    description: item.description,
    color: item.color,
    linearMeters: item.linearMeters?.toString() ?? "",
    squareMeters: item.squareMeters?.toString() ?? "",
    quantity: item.quantity.toString()
  }))
});

const normalizeDecimalValue = (value: string) => value.trim().replace(",", ".");

const parseOptionalNumber = (value: string) => {
  const normalized = normalizeDecimalValue(value);
  return normalized ? Number.parseFloat(normalized) : null;
};

const normalizeItem = (item: DeliveryNoteItemFormState): DeliveryNoteItemDraft => ({
  description: item.description.trim(),
  color: item.color.trim(),
  linearMeters: parseOptionalNumber(item.linearMeters),
  squareMeters: parseOptionalNumber(item.squareMeters),
  saveAsSpecialPiece: item.saveAsSpecialPiece,
  thickness: item.hasThickness ? 1 : null,
  primer: item.hasPrimer,
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
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeliveryNoteStatus | "ALL">("ALL");
  const [customerFilter, setCustomerFilter] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [itemFieldErrors, setItemFieldErrors] = useState<Record<number, DeliveryNoteItemFieldErrors>>(
    {}
  );
  const [previews, setPreviews] = useState<Record<number, PricePreviewState>>({});
  const [pendingScrollToItemIndex, setPendingScrollToItemIndex] = useState<number | null>(null);
  const [openTemplatePickerIndex, setOpenTemplatePickerIndex] = useState<number | null>(null);
  const dateFilterInputRef = useRef<HTMLInputElement | null>(null);
  const formDateInputRef = useRef<HTMLInputElement | null>(null);
  const customerSectionRef = useRef<HTMLDivElement | null>(null);
  const formErrorRef = useRef<HTMLParagraphElement | null>(null);

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) {
      return;
    }

    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
    }
  };

  const customersQuery = useQuery({
    queryKey: ["customers", "all-for-delivery-notes"],
    queryFn: () => getCustomers()
  });

  const deliveryNotesQuery = useQuery({
    queryKey: ["delivery-notes", statusFilter, customerFilter, todayOnly, dateFilter],
    queryFn: () =>
      getDeliveryNotes({
        date: dateFilter || undefined,
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
    return selectedCustomer?.specialPieces.map((piece) => piece.name) ?? [];
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

  useEffect(() => {
    if (!formError) {
      return;
    }

    formErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [formError]);

  const createMutation = useMutation({
    mutationFn: createDeliveryNote,
    onSuccess: async (result) => {
      setEditingNoteId(null);
      setSelectedNoteId(result.deliveryNote.id);
      setForm(emptyForm());
      setCustomerSearch("");
      setFormError(null);
      setItemFieldErrors({});
      setIsComposerOpen(false);
      setOpenTemplatePickerIndex(null);
      setPreviews({});
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
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
      setItemFieldErrors({});
      setIsComposerOpen(false);
      setOpenTemplatePickerIndex(null);
      setPreviews({});
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeliveryNote,
    onSuccess: async () => {
      setSelectedNoteId(null);
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryNoteStatus }) =>
      updateDeliveryNoteStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
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
    setItemFieldErrors({});

    if (!form.customerId) {
      setFormError("Selecciona un cliente antes de guardar el albaran.");
      customerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const nextItemErrors = form.items.reduce<Record<number, DeliveryNoteItemFieldErrors>>(
      (accumulator, item, index) => {
        const errors: DeliveryNoteItemFieldErrors = {};

        if (!item.description.trim()) {
          errors.description = "Escribe una pieza o selecciona una especial.";
        }

        if (!item.color.trim()) {
          errors.color = "Selecciona un color.";
        }

        if (errors.description || errors.color) {
          accumulator[index] = errors;
        }

        return accumulator;
      },
      {}
    );

    const firstInvalidItemIndex = Object.keys(nextItemErrors)
      .map((key) => Number.parseInt(key, 10))
      .find((index) => Number.isFinite(index));

    if (typeof firstInvalidItemIndex === "number") {
      setItemFieldErrors(nextItemErrors);
      setFormError("Revisa la pieza marcada. Falta completar datos obligatorios.");
      setPendingScrollToItemIndex(firstInvalidItemIndex);
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
          <p className="text-sm font-medium text-[var(--epx-text-muted)]">Albaranes</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Cola de albaranes
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--epx-text-muted)]">
            Gestion de trabajos con seleccion de cliente, calculo de precios y
            numeracion automatica.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.16)] px-4 py-3 text-sm font-semibold text-white"
          onClick={() => {
            setEditingNoteId(null);
            setForm(emptyForm());
            setCustomerSearch("");
            setOpenTemplatePickerIndex(null);
            setPreviews({});
            setFormError(null);
            setItemFieldErrors({});
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
          <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-4">
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {(["ALL", "DRAFT", "PENDING", "REVIEWED"] as const).map((value) => (
                  <button
                    className={`rounded-full px-3 py-2 text-sm font-semibold ${
                      statusFilter === value
                        ? "bg-[var(--epx-accent)] text-[#131313]"
                        : "border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] text-[var(--epx-text-muted)]"
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
                      ? "bg-[var(--epx-accent)] text-[#131313]"
                      : "border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] text-[var(--epx-text-muted)]"
                  }`}
                  onClick={() =>
                    setTodayOnly((current) => {
                      const next = !current;
                      if (next) {
                        setDateFilter("");
                      }
                      return next;
                    })
                  }
                  type="button"
                >
                  Hoy
                </button>
                <button
                  className="w-full rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-left text-sm text-white sm:w-auto sm:min-w-44"
                  onClick={() => openDatePicker(dateFilterInputRef.current)}
                  type="button"
                >
                  {dateFilter
                    ? new Date(dateFilter).toLocaleDateString("es-ES")
                    : "Seleccionar fecha"}
                </button>
                <input
                  className="pointer-events-none absolute opacity-0"
                  onChange={(event) => {
                    setDateFilter(event.target.value);
                    if (event.target.value) {
                      setTodayOnly(false);
                    }
                  }}
                  ref={dateFilterInputRef}
                  tabIndex={-1}
                  type="date"
                  value={dateFilter}
                />
                <select
                  className="w-full rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-sm text-white sm:w-auto sm:min-w-52"
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
              <div className="grid gap-2 border-t border-[var(--epx-surface-raised)] pt-3 text-sm text-[var(--epx-text-muted)]">
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
                      ? "border-[var(--epx-accent)]/50 bg-[color:rgb(255_149_0_/_0.12)]"
                      : "border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] hover:border-[var(--epx-accent)]/35"
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
                      <p className="mt-1 text-sm text-[var(--epx-text-muted)]">{note.customerName}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeByStatus[note.status]}`}>
                      {statusLabel[note.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-[var(--epx-text-muted)]">
                      {note.items.length} lineas · {new Date(note.date).toLocaleDateString("es-ES")}
                    </span>
                    <span className="font-mono text-[var(--epx-accent)]">
                      {note.totalAmount.toFixed(2)} €
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-[var(--epx-surface-raised)] p-8 text-sm text-[var(--epx-text-muted)]">
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
            <article className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5">
              <button
                className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-2 text-sm font-semibold text-white xl:hidden"
                onClick={() => setMobilePane("list")}
                type="button"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Volver a la lista
              </button>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--epx-text-muted)]">Albaran seleccionado</p>
                  <h3 className="mt-1 text-2xl font-semibold text-white">
                    {selectedNote.number}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--epx-text-muted)]">
                    {selectedNote.customerName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => {
                      setEditingNoteId(selectedNote.id);
                      setForm(noteToFormState(selectedNote));
                      setCustomerSearch(selectedNote.customerName);
                      setFormError(null);
                      setItemFieldErrors({});
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
                      className="rounded-2xl border border-[var(--epx-success)]/30 bg-[color:rgb(209_255_0_/_0.12)] px-4 py-3 text-sm font-semibold text-[var(--epx-success)]"
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
                      className="rounded-2xl border border-[var(--epx-danger)]/30 bg-[color:rgb(176_0_32_/_0.14)] px-4 py-3 text-sm font-semibold text-white"
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
                <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--epx-text-muted)]">
                    Estado
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {statusLabel[selectedNote.status]}
                  </p>
                  <p className="mt-2 text-sm text-[var(--epx-text-muted)]">
                    {statusHelp[selectedNote.status]}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--epx-text-muted)]">
                    Fecha
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {new Date(selectedNote.date).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--epx-accent)]">
                    Total
                  </p>
                  <p className="mt-2 text-xl font-bold text-[var(--epx-accent)]">
                    {selectedNote.totalAmount.toFixed(2)} €
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {selectedNote.items.map((item, index) => (
                  <div
                    className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2.5"
                    key={`${selectedNote.id}-${index}`}
                  >
                    <div className="grid grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto] items-center gap-2 text-xs sm:text-sm">
                      <p className="truncate font-semibold text-white">
                        {item.description}
                      </p>
                      <span className="truncate text-[var(--epx-text-muted)]">
                        {item.color}
                      </span>
                      <span className="text-[var(--epx-text-muted)]">
                        x{item.quantity}
                      </span>
                      <span className="text-[var(--epx-text-muted)]">
                        ML {(item.linearMeters ?? 0).toFixed(2)} · M2 {(item.squareMeters ?? 0).toFixed(2)}
                      </span>
                      <span className="font-mono font-semibold text-[var(--epx-accent)]">
                        {item.totalPrice.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {isComposerOpen ? (
            <div className="fixed inset-0 z-40 bg-[color:rgb(19_19_19_/_0.78)] backdrop-blur sm:flex sm:items-center sm:justify-center">
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
              autoComplete="off"
              className="absolute inset-0 z-10 flex h-full w-full flex-col bg-[var(--epx-surface)] shadow-2xl shadow-black/40 sm:relative sm:inset-auto sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-[2rem] sm:border sm:border-[var(--epx-surface-raised)]"
              onSubmit={(event) => {
                event.preventDefault();
                void submitForm(editingNoteId ? "PENDING" : "DRAFT");
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 pb-2 pt-1.5 sm:px-5 sm:pb-3 sm:pt-2">
                <h3 className="text-lg font-bold text-white">
                  {editingNoteId ? "Editar albaran" : "Nuevo albaran"}
                </h3>
                <button
                  className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-1 text-sm text-[var(--epx-text-muted)]"
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
              <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3 items-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                    Fecha
                  </p>
                  <button
                    className="mt-2 flex items-center gap-2 text-left text-sm text-white"
                    onClick={() => openDatePicker(formDateInputRef.current)}
                    type="button"
                  >
                    <CalendarDaysIcon className="h-4 w-4 text-[var(--epx-accent)]" />
                    <span>{new Date(form.date).toLocaleDateString("es-ES")}</span>
                  </button>
                  <input
                    className="pointer-events-none absolute opacity-0"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, date: event.target.value }))
                    }
                    ref={formDateInputRef}
                    tabIndex={-1}
                    type="date"
                    value={form.date}
                  />
                </div>

                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                    Cliente
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {selectedCustomer?.name ?? (customerSearch.trim() || "Sin cliente")}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                    Albaran
                  </p>
                  <p className="mt-2 text-xs font-semibold text-white sm:text-sm">
                    {editingNoteId && selectedNote ? selectedNote.number : "Sin numero"}
                  </p>
                </div>
              </div>

              <div id="delivery-note-customer-section" ref={customerSectionRef}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--epx-text-muted)]">
                  Cliente
                </p>
                <input
                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder:text-[var(--epx-text-muted)] ${
                    !form.customerId && formError
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-[var(--epx-surface-raised)] bg-[var(--epx-bg)]"
                  }`}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value);
                    setForm((current) => ({ ...current, customerId: "" }));
                  }}
                  placeholder="Escribe la primera letra del cliente"
                  value={customerSearch}
                />

                {filteredCustomerSuggestions.length ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)]">
                    {filteredCustomerSuggestions.map((customer) => (
                      <button
                        className="flex w-full items-center justify-between gap-3 border-b border-[var(--epx-surface-raised)] px-4 py-3 text-left text-sm text-white last:border-b-0 hover:bg-white/5"
                        key={customer.id}
                        onClick={() => {
                          setForm((current) => ({ ...current, customerId: customer.id }));
                          setCustomerSearch(customer.name);
                        }}
                        type="button"
                      >
                        <span className="font-medium">{customer.name}</span>
                        <span className="text-xs text-[var(--epx-text-muted)]">
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
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--epx-surface-raised)] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:border-[color:rgb(255_255_255_/_0.05)] disabled:text-[var(--epx-text-muted)]"
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
                      setItemFieldErrors({});
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
                    className="space-y-4 rounded-3xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4"
                    id={`delivery-note-piece-${index}`}
                    key={`item-${index}`}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                            Pieza
                          </p>
                          <input
                            autoComplete="off"
                            data-form-type="other"
                            data-lpignore="true"
                            className={`w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder:text-[var(--epx-text-muted)] ${
                              itemFieldErrors[index]?.description
                                ? "border-red-500/60 bg-red-500/10"
                                : "border-[var(--epx-surface-raised)] bg-[var(--epx-bg)]"
                            }`}
                            name={`delivery-note-piece-description-${index}`}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setForm((current) => ({
                                ...current,
                                items: current.items.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, description: nextValue }
                                    : entry
                                )
                              }));
                              setItemFieldErrors((current) => {
                                if (!current[index]?.description) {
                                  return current;
                                }

                                return {
                                  ...current,
                                  [index]: {
                                    ...current[index],
                                    description: undefined
                                  }
                                };
                              });
                            }}
                            placeholder="Introduce una pieza"
                            value={item.description}
                          />
                        </div>

                        <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-2.5 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--epx-text-muted)]">
                            Especial
                          </p>
                          <button
                            className={`mt-2 flex items-center gap-2 rounded-2xl border px-2 py-1.5 text-xs font-semibold transition-colors ${
                              item.saveAsSpecialPiece
                                ? "border-[var(--epx-accent)]/35 bg-[color:rgb(255_149_0_/_0.16)] text-white"
                                : "border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] text-[var(--epx-text-muted)]"
                            }`}
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                items: current.items.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? {
                                        ...entry,
                                        saveAsSpecialPiece: !entry.saveAsSpecialPiece
                                      }
                                    : entry
                                )
                              }))
                            }
                            type="button"
                          >
                            <span className="text-[11px]">{item.saveAsSpecialPiece ? "Si" : "No"}</span>
                            <span
                              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                                item.saveAsSpecialPiece
                                  ? "bg-[var(--epx-accent)]"
                                  : "bg-[color:rgb(255_255_255_/_0.15)]"
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                  item.saveAsSpecialPiece
                                    ? "translate-x-4"
                                    : "translate-x-1"
                                }`}
                              />
                            </span>
                          </button>
                        </div>
                      </div>
                      {itemFieldErrors[index]?.description ? (
                        <p className="text-sm text-red-300">
                          {itemFieldErrors[index].description}
                        </p>
                      ) : null}

                      {availableItemTemplates.length ? (
                        <div className="space-y-3 rounded-2xl border border-[var(--epx-accent)]/25 bg-[color:rgb(255_149_0_/_0.08)] p-3">
                          <button
                            className="flex w-full items-center justify-between rounded-2xl border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] px-4 py-3 text-left text-sm font-semibold text-white"
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
                            <div className="overflow-hidden rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)]">
                              {availableItemTemplates.map((template) => (
                                <button
                                  className={`flex w-full items-center justify-between border-b border-[var(--epx-surface-raised)] px-4 py-3 text-left text-sm last:border-b-0 ${
                                    item.description === template
                                      ? "bg-[color:rgb(255_149_0_/_0.16)] text-white"
                                      : "text-[var(--epx-text-muted)] hover:bg-white/5"
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
                                    <span className="text-xs font-semibold text-[var(--epx-accent)]">
                                      Seleccionada
                                    </span>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_152px]">
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
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

                      <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-2">
                        <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                          Cantidad
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            className="rounded-xl border border-[var(--epx-surface-raised)] p-2 text-[var(--epx-text-muted)]"
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
                            className="rounded-xl border border-[var(--epx-surface-raised)] p-2 text-[var(--epx-text-muted)]"
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
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_170px_170px]">
                      {([
                        { key: "linearMeters", label: "ML" },
                        { key: "squareMeters", label: "M2" }
                      ] as const).map((field) => (
                        <label
                          className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3"
                          key={`${index}-${field.key}`}
                        >
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
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

                      <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                          Grosor
                        </span>
                        <button
                          className={`mt-3 flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
                            item.hasThickness
                              ? "border-[var(--epx-accent)]/35 bg-[color:rgb(255_149_0_/_0.16)] text-white"
                              : "border-[var(--epx-surface-raised)] bg-[color:rgb(255_255_255_/_0.04)] text-[var(--epx-text-muted)]"
                          }`}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, hasThickness: !entry.hasThickness }
                                  : entry
                              )
                            }))
                          }
                          type="button"
                        >
                          <span>{item.hasThickness ? "Activado" : "Desactivado"}</span>
                          <span
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              item.hasThickness
                                ? "bg-[var(--epx-accent)]"
                                : "bg-[color:rgb(255_255_255_/_0.15)]"
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                item.hasThickness ? "translate-x-5" : "translate-x-1"
                              }`}
                            />
                          </span>
                        </button>
                      </div>

                      <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                          Imprimacion
                        </span>
                        <button
                          className={`mt-3 flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
                            item.hasPrimer
                              ? "border-[var(--epx-accent)]/35 bg-[color:rgb(255_149_0_/_0.16)] text-white"
                              : "border-[var(--epx-surface-raised)] bg-[color:rgb(255_255_255_/_0.04)] text-[var(--epx-text-muted)]"
                          }`}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, hasPrimer: !entry.hasPrimer }
                                  : entry
                              )
                            }))
                          }
                          type="button"
                        >
                          <span>{item.hasPrimer ? "Activado" : "Desactivado"}</span>
                          <span
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              item.hasPrimer
                                ? "bg-[var(--epx-accent)]"
                                : "bg-[color:rgb(255_255_255_/_0.15)]"
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                item.hasPrimer ? "translate-x-5" : "translate-x-1"
                              }`}
                            />
                          </span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">
                      Puedes rellenar metros lineales, metros cuadrados o ambos. Activa grosor e imprimacion para aplicar sus recargos sobre la pieza.
                    </p>

                    <div className="space-y-3 rounded-2xl border border-[var(--epx-accent)]/25 bg-[color:rgb(255_149_0_/_0.12)] px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {previews[index]
                              ? `Total pieza ${previews[index].totalPrice.toFixed(2)} €`
                              : "Completa cliente, descripcion y color para ver precio"}
                          </p>
                          {previews[index] ? (
                            <p className="mt-1 text-[var(--epx-accent)]/90">
                              Unitario {previews[index].unitPrice.toFixed(2)} €
                            </p>
                          ) : null}
                        </div>
                        {form.items.length > 1 ? (
                          <button
                            className="rounded-2xl border border-[var(--epx-surface-raised)] px-3 py-2 text-white"
                            onClick={() => {
                              setForm((current) => ({
                                ...current,
                                items: current.items.filter((_, entryIndex) => entryIndex !== index)
                              }));
                              setItemFieldErrors((current) =>
                                Object.entries(current).reduce<
                                  Record<number, DeliveryNoteItemFieldErrors>
                                >((accumulator, [entryIndex, entryErrors]) => {
                                  const numericIndex = Number.parseInt(entryIndex, 10);
                                  if (numericIndex === index) {
                                    return accumulator;
                                  }

                                  accumulator[numericIndex > index ? numericIndex - 1 : numericIndex] =
                                    entryErrors;
                                  return accumulator;
                                }, {})
                              );
                            }}
                            type="button"
                          >
                            Quitar
                          </button>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-xs text-white">
                        <div className="grid grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto] items-center gap-2">
                          <span className="truncate font-medium">
                            {item.description || "Pieza pendiente"}
                          </span>
                          <span className="truncate text-[var(--epx-text-muted)]">
                            {item.color || "Sin color"}
                          </span>
                          <span className="text-[var(--epx-text-muted)]">
                            x{item.quantity || "1"}
                          </span>
                          <span className="text-[var(--epx-text-muted)]">
                            ML {item.linearMeters || "0"} · M2 {item.squareMeters || "0"}
                          </span>
                          <span className="font-semibold text-[var(--epx-accent)]">
                            {previews[index]
                              ? `${previews[index].totalPrice.toFixed(2)} €`
                              : "--"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <textarea
                className="min-h-24 w-full rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3 text-sm text-white placeholder:text-[var(--epx-text-muted)]"
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Notas del trabajo"
                value={form.notes}
              />

              {formError || mutationError ? (
                <p
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                  ref={formErrorRef}
                >
                  {formError ?? mutationError}
                </p>
              ) : null}
              </div>

              <div className="flex items-center gap-2 border-t border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 py-2 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Resumen
                  </p>
                  <p className="text-base font-bold text-[var(--epx-accent)]">
                    {liveTotal.toFixed(2)} €
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[color:rgb(255_255_255_/_0.05)] px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => void submitForm("DRAFT")}
                    type="button"
                  >
                    Borrador
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--epx-accent)] px-3 py-2 text-sm font-semibold text-[#131313]"
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
            <div className="rounded-3xl border border-dashed border-[var(--epx-surface-raised)] p-8 text-sm text-[var(--epx-text-muted)]">
              Selecciona un albaran o crea uno nuevo para ver su detalle.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

