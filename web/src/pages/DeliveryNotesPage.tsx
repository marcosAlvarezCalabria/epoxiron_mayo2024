import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  ItemFormSheet,
  type DeliveryNoteItemFormState
} from "@/components/delivery-notes/ItemFormSheet";
import type {
  Customer,
  DeliveryNote,
  DeliveryNoteInput,
  DeliveryNoteItemDraft,
  DeliveryNoteStatus
} from "@/domain/entities";
import { ApiError } from "@/infrastructure/api/apiClient";
import { estimateDeliveryNoteItemPrice, type PricePreviewState } from "@/lib/pricing";

interface DeliveryNoteFormState {
  customerId: string;
  date: string;
  items: DeliveryNoteItemFormState[];
  notes: string;
}

const badgeByStatus: Record<DeliveryNoteStatus, string> = {
  DRAFT: "border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] text-[var(--epx-text-muted)]",
  PENDING:
    "border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] text-[var(--epx-accent)]",
  REVIEWED:
    "border border-[var(--epx-success)]/30 bg-[color:rgb(209_255_0_/_0.12)] text-[var(--epx-success)]"
};

const statusLabel: Record<DeliveryNoteStatus, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  REVIEWED: "Revisado"
};

const emptyItem = (): DeliveryNoteItemFormState => ({
  hasThickness: false,
  hasPrimer: false,
  saveAsSpecialPiece: false,
  description: "",
  color: "RAL 7016",
  linearMeters: "",
  quantity: "1",
  squareMeters: ""
});

const emptyForm = (): DeliveryNoteFormState => ({
  customerId: "",
  date: new Date().toISOString().slice(0, 10),
  items: [],
  notes: ""
});

const noteToFormState = (note: DeliveryNote): DeliveryNoteFormState => ({
  customerId: note.customerId,
  date: note.date.slice(0, 10),
  items: note.items.map((item) => ({
    hasThickness: item.thickness != null,
    hasPrimer: item.primer ?? false,
    saveAsSpecialPiece: false,
    description: item.description,
    color: item.color,
    linearMeters: item.linearMeters?.toString() ?? "",
    quantity: item.quantity.toString(),
    squareMeters: item.squareMeters?.toString() ?? ""
  })),
  notes: note.notes ?? ""
});

const normalizeDecimalValue = (value: string) => value.trim().replace(",", ".");

const parseOptionalNumber = (value: string) => {
  const normalized = normalizeDecimalValue(value);
  return normalized ? Number.parseFloat(normalized) : null;
};

const normalizeItem = (item: DeliveryNoteItemFormState): DeliveryNoteItemDraft => ({
  color: item.color.trim(),
  description: item.description.trim(),
  linearMeters: parseOptionalNumber(item.linearMeters),
  primer: item.hasPrimer,
  quantity: Number.parseInt(item.quantity || "1", 10),
  saveAsSpecialPiece: item.saveAsSpecialPiece,
  squareMeters: parseOptionalNumber(item.squareMeters),
  thickness: item.hasThickness ? 1 : null
});

const normalizePayload = (form: DeliveryNoteFormState, status: DeliveryNoteStatus): DeliveryNoteInput => ({
  customerId: form.customerId,
  date: new Date(form.date).toISOString(),
  items: form.items.map(normalizeItem),
  notes: form.notes.trim() ? form.notes.trim() : null,
  status
});

const formatCurrency = (value: number) => `${value.toFixed(2)} €`;

const isItemComplete = (item: DeliveryNoteItemFormState) =>
  Boolean(item.description.trim() && item.color.trim() && Number.parseInt(item.quantity || "0", 10) > 0);

export const DeliveryNotesPage = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [form, setForm] = useState<DeliveryNoteFormState>(emptyForm);
  const [customerSearch, setCustomerSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeliveryNoteStatus | "ALL">("ALL");
  const [customerFilter, setCustomerFilter] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<number, PricePreviewState>>({});
  const [sheetState, setSheetState] = useState<{ index: number | null; mode: "create" | "edit"; open: boolean }>({
    index: null,
    mode: "create",
    open: false
  });
  const dateFilterInputRef = useRef<HTMLInputElement | null>(null);
  const formDateInputRef = useRef<HTMLInputElement | null>(null);
  const composerContentRef = useRef<HTMLDivElement | null>(null);

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
        customerId: customerFilter || undefined,
        date: dateFilter || undefined,
        status: statusFilter,
        today: todayOnly
      })
  });

  const selectedCustomer =
    customersQuery.data?.customers.find((customer) => customer.id === form.customerId) ?? null;

  const filteredCustomerSuggestions = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return (customersQuery.data?.customers ?? [])
      .filter((customer) =>
        customer.name
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.startsWith(query))
      )
      .slice(0, 8);
  }, [customerSearch, customersQuery.data?.customers]);

  const availableItemTemplates = useMemo(
    () => selectedCustomer?.specialPieces.map((piece) => piece.name) ?? [],
    [selectedCustomer]
  );

  const selectedNote =
    deliveryNotesQuery.data?.deliveryNotes.find((note) => note.id === selectedNoteId) ??
    deliveryNotesQuery.data?.deliveryNotes[0] ??
    null;

  const requestedNoteId = searchParams.get("noteId");

  useEffect(() => {
    if (!requestedNoteId || !deliveryNotesQuery.data?.deliveryNotes.length) {
      return;
    }

    const requested = deliveryNotesQuery.data.deliveryNotes.find((note) => note.id === requestedNoteId);
    if (!requested) {
      return;
    }

    setSelectedNoteId(requested.id);
    setMobilePane("detail");
  }, [deliveryNotesQuery.data?.deliveryNotes, requestedNoteId]);

  useEffect(() => {
    if (!isComposerOpen) {
      return;
    }

    if (!form.customerId || form.items.length === 0) {
      setPreviews({});
      return;
    }

    const activeEntries = form.items
      .map((item, index) => ({ index, item }))
      .filter(({ item }) => isItemComplete(item));

    if (activeEntries.length === 0) {
      setPreviews({});
      return;
    }

    const timeout = window.setTimeout(() => {
      void Promise.all(
        activeEntries.map(async ({ index, item }) => {
          const result = await calculatePricePreview(form.customerId, normalizeItem(item));
          return { index, pricing: result.pricing };
        })
      )
        .then((results) => {
          setPreviews(
            results.reduce<Record<number, PricePreviewState>>((accumulator, result) => {
              accumulator[result.index] = result.pricing;
              return accumulator;
            }, {})
          );
        })
        .catch(() => {
          setPreviews({});
        });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [form, isComposerOpen]);

  const createMutation = useMutation({
    mutationFn: createDeliveryNote,
    onSuccess: async (result) => {
      setSelectedNoteId(result.deliveryNote.id);
      setEditingNoteId(null);
      setForm(emptyForm());
      setPreviews({});
      setFormError(null);
      setIsComposerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DeliveryNoteInput }) =>
      updateDeliveryNote(id, input),
    onSuccess: async (result) => {
      setSelectedNoteId(result.deliveryNote.id);
      setEditingNoteId(null);
      setForm(emptyForm());
      setPreviews({});
      setFormError(null);
      setIsComposerOpen(false);
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
      form.items.reduce((sum, item, index) => {
        const preview = previews[index];
        if (preview) {
          return sum + preview.totalPrice;
        }

        if (selectedCustomer && isItemComplete(item)) {
          return sum + estimateDeliveryNoteItemPrice(normalizeItem(item), selectedCustomer).totalPrice;
        }

        return sum;
      }, 0),
    [form.items, previews, selectedCustomer]
  );

  const currentSheetItem =
    sheetState.index != null ? form.items[sheetState.index] ?? emptyItem() : emptyItem();

  const customerStepReady = Boolean(form.customerId);
  const itemsStepReady = form.items.length > 0 && form.items.every(isItemComplete);
  const reviewStepReady = customerStepReady && itemsStepReady;

  const closeComposer = () => {
    setEditingNoteId(null);
    setForm(emptyForm());
    setPreviews({});
    setFormError(null);
    setCustomerSearch("");
    setIsComposerOpen(false);
    setSheetState({ index: null, mode: "create", open: false });
  };

  const openNewComposer = () => {
    setEditingNoteId(null);
    setForm(emptyForm());
    setPreviews({});
    setFormError(null);
    setCustomerSearch("");
    setMobilePane("detail");
    setIsComposerOpen(true);
  };

  const openEditComposer = (note: DeliveryNote) => {
    setEditingNoteId(note.id);
    setForm(noteToFormState(note));
    setPreviews({});
    setFormError(null);
    setCustomerSearch("");
    setMobilePane("detail");
    setIsComposerOpen(true);
  };

  const submitForm = async (status: DeliveryNoteStatus) => {
    setFormError(null);

    if (!form.customerId) {
      setFormError("Selecciona un cliente antes de continuar.");
      composerContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (form.items.length === 0 || !form.items.every(isItemComplete)) {
      setFormError("Anade al menos una pieza completa antes de guardar el albaran.");
      composerContentRef.current?.scrollTo({ top: 320, behavior: "smooth" });
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

  const handleSheetSave = (item: DeliveryNoteItemFormState) => {
    setForm((current) => {
      if (sheetState.mode === "edit" && sheetState.index != null) {
        return {
          ...current,
          items: current.items.map((entry, index) => (index === sheetState.index ? item : entry))
        };
      }

      return {
        ...current,
        items: [...current.items, item]
      };
    });
    setSheetState({ index: null, mode: "create", open: false });
  };

  const removeItem = (index: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index)
    }));
    setPreviews((current) =>
      Object.entries(current).reduce<Record<number, PricePreviewState>>((accumulator, [key, value]) => {
        const numericIndex = Number.parseInt(key, 10);
        if (numericIndex === index) {
          return accumulator;
        }

        accumulator[numericIndex > index ? numericIndex - 1 : numericIndex] = value;
        return accumulator;
      }, {})
    );
  };

  const getStatusAction = (note: DeliveryNote) => {
    if (note.status === "DRAFT") {
      return { action: "Marcar pendiente", nextStatus: "PENDING" as const };
    }

    if (note.status === "PENDING") {
      return { action: "Marcar revisado", nextStatus: "REVIEWED" as const };
    }

    return { action: "Reabrir", nextStatus: "PENDING" as const };
  };

  const getItemPreview = (
    item: DeliveryNoteItemFormState,
    index: number,
    customer: Customer | null
  ) => {
    const preview = previews[index];
    if (preview) {
      return preview;
    }

    if (customer && isItemComplete(item)) {
      return estimateDeliveryNoteItemPrice(normalizeItem(item), customer);
    }

    return null;
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--epx-text-muted)]">Albaranes</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">Cola de albaranes</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--epx-text-muted)]">
            Flujo de taller centrado en movil: cliente, piezas y revision sin perder el total.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 border border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.16)] px-4 py-3 text-sm font-semibold text-white"
          onClick={openNewComposer}
          type="button"
        >
          <PlusIcon className="h-5 w-5" />
          Nuevo albaran
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className={`${mobilePane === "detail" ? "hidden xl:block" : "block"} space-y-4`}>
          <div className="border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-4">
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {(["ALL", "DRAFT", "PENDING", "REVIEWED"] as const).map((value) => (
                  <button
                    className={`px-3 py-2 text-sm font-semibold ${
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
                  className={`px-3 py-2 text-sm font-semibold ${
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
                  className="min-w-44 border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-left text-sm text-white"
                  onClick={() => openDatePicker(dateFilterInputRef.current)}
                  type="button"
                >
                  {dateFilter ? new Date(dateFilter).toLocaleDateString("es-ES") : "Seleccionar fecha"}
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
                  className="min-w-52 border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-sm text-white"
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
            </div>
          </div>

          {deliveryNotesQuery.error instanceof ApiError ? (
            <ApiErrorState
              message={deliveryNotesQuery.error.message}
              title="Error al cargar albaranes"
            />
          ) : null}

          <div className="space-y-3">
            {deliveryNotesQuery.data?.deliveryNotes.map((note) => (
              <button
                className={`w-full border p-4 text-left transition-colors ${
                  selectedNote?.id === note.id
                    ? "border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.12)]"
                    : "border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] hover:border-[var(--epx-accent)]/30"
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
                    <p className="text-sm font-semibold text-white">{note.number}</p>
                    <p className="mt-1 text-sm text-[var(--epx-text-muted)]">{note.customerName}</p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold ${badgeByStatus[note.status]}`}>
                    {statusLabel[note.status]}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-[var(--epx-text-muted)]">
                    {new Date(note.date).toLocaleDateString("es-ES")}
                  </span>
                  <span className="font-semibold text-[var(--epx-accent)]">
                    {formatCurrency(note.totalAmount)}
                  </span>
                </div>
              </button>
            ))}

            {!deliveryNotesQuery.isLoading && !deliveryNotesQuery.data?.deliveryNotes.length ? (
              <div className="border border-dashed border-[var(--epx-surface-raised)] p-6 text-sm text-[var(--epx-text-muted)]">
                No hay albaranes con este filtro.
              </div>
            ) : null}
          </div>
        </div>

        <div className={`${mobilePane === "list" ? "hidden xl:block" : "block"} min-w-0`}>
          {selectedNote ? (
            <article className="border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)]">
              <div className="space-y-5 px-5 py-5">
                <button
                  className="inline-flex items-center gap-2 border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-2 text-sm font-semibold text-white xl:hidden"
                  onClick={() => setMobilePane("list")}
                  type="button"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Volver
                </button>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--epx-text-muted)]">Detalle de albaran</p>
                    <h3 className="mt-1 text-2xl font-semibold text-white">{selectedNote.number}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--epx-text-muted)]">
                      <span className="inline-flex items-center gap-2">
                        <UserCircleIcon className="h-4 w-4 text-[var(--epx-accent)]" />
                        {selectedNote.customerName}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDaysIcon className="h-4 w-4 text-[var(--epx-accent)]" />
                        {new Date(selectedNote.date).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-2 text-sm font-semibold ${badgeByStatus[selectedNote.status]}`}>
                      {statusLabel[selectedNote.status]}
                    </span>
                    <button
                      className="inline-flex items-center gap-2 border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3 text-sm font-semibold text-white"
                      onClick={() => openEditComposer(selectedNote)}
                      type="button"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                      Editar
                    </button>
                    <button
                      className="inline-flex items-center gap-2 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200"
                      onClick={() => {
                        if (window.confirm(`Eliminar ${selectedNote.number}?`)) {
                          deleteMutation.mutate(selectedNote.id);
                        }
                      }}
                      type="button"
                    >
                      <TrashIcon className="h-5 w-5" />
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                  <section className="space-y-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                      Piezas
                    </h4>
                    {selectedNote.items.map((item, index) => (
                      <div
                        className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-3"
                        key={`${selectedNote.id}-${index}`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] text-[var(--epx-text-muted)]">
                          <span className="min-w-0 flex-1 truncate font-semibold text-white">
                            {`${item.description} · ${item.color} · x${item.quantity} · ML ${item.linearMeters ?? 0} · M2 ${item.squareMeters ?? 0}${item.thickness != null ? " · G" : ""}${item.primer ? " · I" : ""}`}
                            <span className="hidden mt-1 text-xs text-[var(--epx-text-muted)]">
                              {item.color} · x{item.quantity}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-[var(--epx-accent)]">
                            {formatCurrency(item.totalPrice)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--epx-text-muted)]">
                          <span>ML {item.linearMeters ?? 0}</span>
                          <span>M2 {item.squareMeters ?? 0}</span>
                          {item.thickness != null ? <span>Grosor</span> : null}
                          {item.primer ? <span>Imprimacion</span> : null}
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="space-y-4">
                    <div className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                        Estado
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {selectedNote.status === "DRAFT"
                          ? "Aun editable y pendiente de preparar."
                          : selectedNote.status === "PENDING"
                            ? "Preparado y pendiente de revision final."
                            : "Revisado y validado para salida."}
                      </p>
                    </div>

                    <div className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                        Notas
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {selectedNote.notes ?? "Sin notas para este albaran."}
                      </p>
                    </div>
                  </section>
                </div>
              </div>

              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--epx-surface-raised)] bg-[color:rgb(28_27_27_/_0.96)] px-5 py-4 backdrop-blur">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                    Total
                  </p>
                  <p className="text-2xl font-bold text-[var(--epx-accent)]">
                    {formatCurrency(selectedNote.totalAmount)}
                  </p>
                </div>

                <button
                  className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold ${
                    selectedNote.status === "REVIEWED"
                      ? "border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] text-white"
                      : "bg-[var(--epx-accent)] text-[#131313]"
                  }`}
                  disabled={statusMutation.isPending}
                  onClick={() => {
                    const statusAction = getStatusAction(selectedNote);
                    statusMutation.mutate({
                      id: selectedNote.id,
                      status: statusAction.nextStatus
                    });
                  }}
                  type="button"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  {getStatusAction(selectedNote).action}
                </button>
              </div>
            </article>
          ) : (
            <div className="border border-dashed border-[var(--epx-surface-raised)] p-8 text-sm text-[var(--epx-text-muted)]">
              Selecciona un albaran o crea uno nuevo para empezar.
            </div>
          )}
        </div>
      </div>

      {isComposerOpen ? (
        <div className="fixed inset-0 z-40 bg-[color:rgb(19_19_19_/_0.82)] backdrop-blur-sm">
          <button
            aria-label="Cerrar editor de albaran"
            className="absolute inset-0"
            onClick={closeComposer}
            type="button"
          />

          <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] sm:inset-6">
            <div className="border-b border-[var(--epx-surface-raised)] bg-[color:rgb(28_27_27_/_0.96)] px-5 py-4 backdrop-blur sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--epx-accent)]">
                    {editingNoteId ? "Editar albaran" : "Nuevo albaran"}
                  </p>
                </div>
                <button
                  className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-[var(--epx-text-muted)]"
                  onClick={closeComposer}
                  type="button"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6" ref={composerContentRef}>
              <div className="grid gap-6 xl:grid-cols-[0.74fr_1.26fr]">
                <section className="space-y-4">
                  <div className={`border p-4 ${customerStepReady ? "border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.08)]" : "border-[var(--epx-surface-raised)] bg-[var(--epx-bg)]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                          Paso 1
                        </p>
                        <h4 className="mt-1 text-lg font-semibold text-white">Cliente</h4>
                      </div>
                      {selectedCustomer ? (
                        <span className="border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] px-3 py-1 text-xs font-semibold text-[var(--epx-accent)]">
                          Seleccionado
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-3">
                      <input
                        className="w-full border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--epx-text-muted)]"
                        onChange={(event) => setCustomerSearch(event.target.value)}
                        placeholder="Introduce un cliente"
                        value={customerSearch}
                      />

                      {selectedCustomer ? (
                        <button
                          className="w-full border border-[var(--epx-accent)]/35 bg-[color:rgb(255_149_0_/_0.12)] px-4 py-4 text-left"
                          onClick={() => setForm((current) => ({ ...current, customerId: "" }))}
                          type="button"
                        >
                          <p className="text-sm font-semibold text-white">{selectedCustomer.name}</p>
                          <p className="mt-1 text-xs text-[var(--epx-text-muted)]">
                            {selectedCustomer.phone ?? selectedCustomer.email ?? "Sin contacto"}
                          </p>
                        </button>
                      ) : (
                        <div className="space-y-2">
                          {filteredCustomerSuggestions.map((customer) => (
                            <button
                              className="w-full border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 py-3 text-left text-sm text-white transition-colors hover:border-[var(--epx-accent)]/30"
                              key={customer.id}
                              onClick={() => {
                                setForm((current) => ({ ...current, customerId: customer.id }));
                                setCustomerSearch(customer.name);
                              }}
                              type="button"
                            >
                              <p className="font-semibold">{customer.name}</p>
                              <p className="mt-1 text-xs text-[var(--epx-text-muted)]">
                                {customer.phone ?? customer.email ?? "Sin contacto"}
                              </p>
                            </button>
                          ))}

                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                          Fecha
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {new Date(form.date).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                      <button
                        className="border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => openDatePicker(formDateInputRef.current)}
                        type="button"
                      >
                        Cambiar
                      </button>
                    </div>
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
                </section>

                <section className="space-y-4">
                  <div className={`border p-4 ${itemsStepReady ? "border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.08)]" : "border-[var(--epx-surface-raised)] bg-[var(--epx-bg)]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                          Paso 2
                        </p>
                        <h4 className="mt-1 text-lg font-semibold text-white">Piezas del albaran</h4>
                      </div>
                      <button
                        className="inline-flex items-center gap-1.5 bg-[var(--epx-accent)] px-2.5 py-1.5 text-xs font-semibold text-[#131313]"
                        onClick={() => setSheetState({ index: null, mode: "create", open: true })}
                        type="button"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Anadir pieza
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {form.items.length ? (
                        form.items.map((item, index) => (
                          <article
                            className="border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-3"
                            key={`draft-item-${index}`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] text-[var(--epx-text-muted)]">
                              <span className="min-w-0 flex-1 truncate font-semibold text-white">
                                <span className="truncate text-[11px] font-semibold text-white">
                                  {`${item.description || "Pieza pendiente"} · ${item.color || "Sin color"} · x${item.quantity} · ML ${item.linearMeters || "0"} · M2 ${item.squareMeters || "0"}${item.hasThickness ? " · G" : ""}${item.hasPrimer ? " · I" : ""}${item.saveAsSpecialPiece ? " · ESP" : ""}`}
                                </span>
                                <span className="hidden truncate text-[10px] text-[var(--epx-text-muted)]">
                                  {item.color || "Sin color"} · x{item.quantity}
                                </span>
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-[var(--epx-accent)]">
                                {getItemPreview(item, index, selectedCustomer)
                                  ? formatCurrency(getItemPreview(item, index, selectedCustomer)!.totalPrice)
                                  : "—"}
                              </span>
                            </div>
                            <div className="hidden mt-3 flex flex-wrap gap-2 text-xs text-[var(--epx-text-muted)]">
                              <span>ML {item.linearMeters || "0"}</span>
                              <span>M2 {item.squareMeters || "0"}</span>
                              {item.hasThickness ? <span>Grosor</span> : null}
                              {item.hasPrimer ? <span>Imprimacion</span> : null}
                              {item.saveAsSpecialPiece ? <span>Guardar especial</span> : null}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                className="inline-flex items-center gap-2 border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-sm font-semibold text-white"
                                onClick={() => setSheetState({ index, mode: "edit", open: true })}
                                type="button"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                className="inline-flex items-center gap-2 border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200"
                                onClick={() => removeItem(index)}
                                type="button"
                              >
                                <TrashIcon className="h-4 w-4" />
                                Quitar
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="border border-dashed border-[var(--epx-surface-raised)] px-4 py-6 text-sm text-[var(--epx-text-muted)]">
                          Todavia no hay piezas. Anade la primera para continuar.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                      Paso 3
                    </p>
                    <h4 className="mt-1 text-lg font-semibold text-white">Revision final</h4>
                    <textarea
                      className="mt-4 min-h-28 w-full border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--epx-text-muted)]"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      placeholder="Notas del trabajo"
                      value={form.notes}
                    />

                    {formError || mutationError ? (
                      <p className="mt-3 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {formError ?? mutationError}
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--epx-surface-raised)] bg-[color:rgb(28_27_27_/_0.96)] px-5 py-4 backdrop-blur sm:px-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                  Total del albaran
                </p>
                <p className="text-2xl font-bold text-[var(--epx-accent)]">{formatCurrency(liveTotal)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3 text-sm font-semibold text-white"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  onClick={() => void submitForm("DRAFT")}
                  type="button"
                >
                  Guardar borrador
                </button>
                <button
                  className="inline-flex items-center gap-2 bg-[var(--epx-accent)] px-4 py-3 text-sm font-semibold text-[#131313]"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  onClick={() => void submitForm("PENDING")}
                  type="button"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  Marcar pendiente
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ItemFormSheet
        availableTemplates={availableItemTemplates}
        customer={selectedCustomer}
        customerId={form.customerId}
        initialItem={currentSheetItem}
        isOpen={sheetState.open}
        mode={sheetState.mode}
        onClose={() => setSheetState({ index: null, mode: "create", open: false })}
        onSave={handleSheetSave}
      />
    </section>
  );
};
