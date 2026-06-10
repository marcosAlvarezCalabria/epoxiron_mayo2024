import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
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
import { formatDeliveryNoteTexture } from "@/constants/deliveryNoteTextures";
import type {
  Customer,
  DeliveryNote,
  DeliveryNoteInput,
  DeliveryNoteItemDraft,
  DeliveryNoteStatus
} from "@/domain/entities";
import { ApiError } from "@/infrastructure/api/apiClient";
import {
  formatMeters,
  formatMetersSummary,
  formatSquareMeters,
  formatSquareMetersSummary,
  parseMeters,
  parseMetersSquared
} from "@/lib/measurements";
import {
  estimateDeliveryNoteItemPrice,
  resolvePricePreview,
  type PricePreviewState
} from "@/lib/pricing";

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
  customUnitPrice: "",
  description: "",
  color: "RAL 7016",
  pricingMode: "DIMENSIONS",
  texture: "NORMAL",
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
    customUnitPrice: item.customUnitPrice?.toString() ?? "",
    description: item.description,
    color: item.color,
    pricingMode: item.pricingMode,
    texture: item.texture ?? "NORMAL",
    linearMeters: formatMeters(item.linearMeters),
    quantity: item.quantity.toString(),
    squareMeters: formatSquareMeters(item.squareMeters)
  })),
  notes: note.notes ?? ""
});

const normalizeItem = (item: DeliveryNoteItemFormState): DeliveryNoteItemDraft => ({
  color: item.color.trim(),
  customUnitPrice: item.customUnitPrice.trim() ? Number.parseFloat(item.customUnitPrice.replace(",", ".")) : null,
  description: item.description.trim(),
  linearMeters: parseMeters(item.linearMeters),
  pricingMode: item.pricingMode,
  primer: item.hasPrimer,
  quantity: Number.parseInt(item.quantity || "1", 10),
  saveAsSpecialPiece: item.saveAsSpecialPiece,
  squareMeters: parseMetersSquared(item.squareMeters),
  texture: item.texture,
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
const formatArticleTexture = (texture?: DeliveryNoteItemDraft["texture"]) =>
  texture && texture !== "NORMAL" ? formatDeliveryNoteTexture(texture) : null;
const formatDocumentNumber = (value: number) => value.toFixed(2).replace(".", ",");
const formatDocumentDate = (value: string) => new Date(value).toLocaleDateString("es-ES");

const companyReference = {
  name: "Epoxiron S.L.",
  subtitle: "DISEÑOS Y TRANSFORMADOS DEL METAL",
  addressLines: ["C/ MARMOL 2 Pol. Inds. LA TORRECILLA", "45220 YELES", "TOLEDO"],
  contactLines: [
    "AVD DE LOS GREMIOS NAVE 13R",
    "45200 ILLESCAS",
    "TELÉF.: 678786551",
    "CIF: B86428760",
    "epoxiron@gmail.com"
  ]
} as const;

const buildDocumentItemDescription = (item: DeliveryNote["items"][number]) => {
  const segments = [item.description, item.color];
  const texture = formatArticleTexture(item.texture);

  if (texture) {
    segments.push(texture);
  }

  if (item.pricingMode === "UNIT") {
    segments.push("UNIDAD");
  } else {
    if ((item.linearMeters ?? 0) > 0) {
      segments.push(`${formatMetersSummary(item.linearMeters)}MLIN`);
    }

    if ((item.squareMeters ?? 0) > 0) {
      segments.push(`${formatSquareMetersSummary(item.squareMeters)}M2`);
    }
  }

  if (item.thickness != null) {
    segments.push("G");
  }

  if (item.primer) {
    segments.push("I");
  }

  return segments.filter(Boolean).join("·");
};

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
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [sheetState, setSheetState] = useState<{ index: number | null; mode: "create" | "edit"; open: boolean }>({
    index: null,
    mode: "create",
    open: false
  });
  const dateFilterInputRef = useRef<HTMLInputElement | null>(null);
  const formDateInputRef = useRef<HTMLInputElement | null>(null);
  const composerContentRef = useRef<HTMLDivElement | null>(null);
  const previewsRequestIdRef = useRef(0);

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

  const selectedCustomer = useMemo(() => {
    const customers = customersQuery.data?.customers ?? [];
    return customers.find((customer) => customer.id === form.customerId) ?? null;
  }, [customersQuery.data?.customers, form.customerId]);

  const resolvedCustomer = useMemo(() => {
    if (selectedCustomer) {
      return selectedCustomer;
    }

    const customers = customersQuery.data?.customers ?? [];
    const normalizedSearch = customerSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return null;
    }

    const exactMatch =
      customers.find((customer) => customer.name.trim().toLowerCase() === normalizedSearch) ?? null;
    if (exactMatch) {
      return exactMatch;
    }

    return (
      customers.find((customer) =>
        customer.name
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.startsWith(normalizedSearch))
      ) ?? null
    );
  }, [customerSearch, customersQuery.data?.customers, selectedCustomer]);

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
  const selectedNoteCustomer = useMemo(() => {
    if (!selectedNote) {
      return null;
    }

    return (
      customersQuery.data?.customers.find((customer) => customer.id === selectedNote.customerId) ?? null
    );
  }, [customersQuery.data?.customers, selectedNote]);

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
    setIsNotesOpen(false);
  }, [selectedNoteId]);

  useEffect(() => {
    if (!isComposerOpen) {
      return;
    }

    if (!form.customerId || form.items.length === 0) {
      previewsRequestIdRef.current += 1;
      setPreviews({});
      return;
    }

    const activeEntries = form.items
      .map((item, index) => ({ index, item }))
      .filter(({ item }) => isItemComplete(item));

    if (activeEntries.length === 0) {
      previewsRequestIdRef.current += 1;
      setPreviews({});
      return;
    }

    const timeout = window.setTimeout(() => {
      const requestId = previewsRequestIdRef.current + 1;
      previewsRequestIdRef.current = requestId;
      void Promise.all(
        activeEntries.map(async ({ index, item }) => {
          const fallbackPricing = resolvedCustomer
            ? estimateDeliveryNoteItemPrice(normalizeItem(item), resolvedCustomer)
            : null;
          const result = await calculatePricePreview(form.customerId, normalizeItem(item));
          return {
            index,
            pricing: resolvePricePreview(result.pricing, fallbackPricing)
          };
        })
      )
        .then((results) => {
          if (previewsRequestIdRef.current !== requestId) {
            return;
          }
          setPreviews(
            results.reduce<Record<number, PricePreviewState>>((accumulator, result) => {
              if (result.pricing) {
                accumulator[result.index] = result.pricing;
              }
              return accumulator;
            }, {})
          );
        })
        .catch(() => {
          if (previewsRequestIdRef.current !== requestId) {
            return;
          }
          if (!resolvedCustomer) {
            setPreviews({});
            return;
          }

          setPreviews(
            activeEntries.reduce<Record<number, PricePreviewState>>((accumulator, { index, item }) => {
              accumulator[index] = estimateDeliveryNoteItemPrice(normalizeItem(item), resolvedCustomer);
              return accumulator;
            }, {})
          );
        });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [form, isComposerOpen, resolvedCustomer]);

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
        const fallbackPreview =
          resolvedCustomer && isItemComplete(item)
            ? estimateDeliveryNoteItemPrice(normalizeItem(item), resolvedCustomer)
            : null;
        const preview = resolvePricePreview(previews[index] ?? null, fallbackPreview);
        if (preview) {
          return sum + preview.totalPrice;
        }

        return sum;
      }, 0),
    [form.items, previews, resolvedCustomer]
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
    const fallbackPreview =
      resolvedCustomer && isItemComplete(item)
        ? estimateDeliveryNoteItemPrice(normalizeItem(item), resolvedCustomer)
        : null;

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

    if (fallbackPreview) {
      setPreviews((current) => {
        if (sheetState.mode === "edit" && sheetState.index != null) {
          return {
            ...current,
            [sheetState.index]: fallbackPreview
          };
        }

        return {
          ...current,
          [form.items.length]: fallbackPreview
        };
      });
    }

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
    const fallbackPreview =
      customer && isItemComplete(item) ? estimateDeliveryNoteItemPrice(normalizeItem(item), customer) : null;
    return resolvePricePreview(previews[index] ?? null, fallbackPreview);
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
            <article className="border border-neutral-300 bg-white shadow-[0_22px_45px_rgba(0,0,0,0.08)]">
              <div className="space-y-5 px-5 py-5">
                <button
                  className="inline-flex items-center gap-2 border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-2 text-sm font-semibold text-white xl:hidden"
                  onClick={() => setMobilePane("list")}
                  type="button"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Volver
                </button>

                <div className="flex flex-wrap items-start justify-between gap-3 border border-neutral-300 bg-white px-4 py-3">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                        Detalle de albaran
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                        <span className="inline-flex items-center gap-2 font-medium text-neutral-900">
                          <UserCircleIcon className="h-4 w-4 text-neutral-500" />
                          {selectedNote.customerName}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <CalendarDaysIcon className="h-4 w-4 text-neutral-500" />
                          {formatDocumentDate(selectedNote.date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        aria-label={statusLabel[selectedNote.status]}
                        className={`inline-flex h-9 w-9 items-center justify-center border sm:h-8 sm:w-8 ${
                          selectedNote.status === "DRAFT"
                            ? "border-neutral-300 bg-neutral-100 text-neutral-600"
                            : selectedNote.status === "PENDING"
                              ? "border-amber-300 bg-amber-50 text-amber-600"
                              : "border-lime-300 bg-lime-50 text-lime-700"
                        }`}
                        title={statusLabel[selectedNote.status]}
                      >
                        {selectedNote.status === "DRAFT" ? (
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        ) : selectedNote.status === "PENDING" ? (
                          <ClipboardDocumentListIcon className="h-4 w-4" />
                        ) : (
                          <CheckCircleIcon className="h-4 w-4" />
                        )}
                      </span>
                      <button
                        aria-label={isNotesOpen ? "Ocultar anotaciones" : "Mostrar anotaciones"}
                        className={`inline-flex h-9 w-9 items-center justify-center border sm:h-8 sm:w-8 ${
                          isNotesOpen
                            ? "border-amber-300 bg-amber-50 text-amber-600"
                            : "border-neutral-300 bg-white text-neutral-700"
                        }`}
                        onClick={() => setIsNotesOpen((current) => !current)}
                        type="button"
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Editar albaran"
                        className="inline-flex h-9 w-9 items-center justify-center border border-neutral-300 bg-white text-neutral-700 sm:h-8 sm:w-8"
                        onClick={() => openEditComposer(selectedNote)}
                        type="button"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Eliminar albaran"
                        className="inline-flex h-9 w-9 items-center justify-center border border-red-500/20 bg-red-500/10 text-red-200 sm:h-8 sm:w-8"
                        onClick={() => {
                          if (window.confirm(`Eliminar ${selectedNote.number}?`)) {
                            deleteMutation.mutate(selectedNote.id);
                          }
                        }}
                        type="button"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <section className="border border-neutral-300 bg-white px-3 py-3 text-neutral-900 shadow-[0_18px_36px_rgba(0,0,0,0.05)] sm:px-6 sm:py-4">
                  <div className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Empresa</p>
                      <p className="mt-1 text-sm font-semibold tracking-tight text-neutral-900 sm:text-base">
                        {companyReference.name}
                      </p>
                    </div>

                    <div className="min-w-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Cliente</p>
                      <p className="mt-1 text-xs font-semibold text-neutral-900 sm:text-sm">{selectedNote.customerName}</p>
                      {selectedNoteCustomer?.address ? <p className="mt-1 text-[11px] text-neutral-700">{selectedNoteCustomer.address}</p> : null}
                      {selectedNoteCustomer?.phone ? <p className="text-[11px] text-neutral-700">{selectedNoteCustomer.phone}</p> : null}
                      {!selectedNoteCustomer?.phone && selectedNoteCustomer?.email ? (
                        <p className="text-[11px] text-neutral-700">{selectedNoteCustomer.email}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden mt-3 border-b border-neutral-300 pb-3 text-[10px] text-neutral-700">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Albaran</p>
                      <p className="mt-0.5 text-[11px] text-neutral-900">{selectedNote.number}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Fecha</p>
                      <p className="mt-0.5 text-[11px] text-neutral-900">{formatDocumentDate(selectedNote.date)}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Cliente</p>
                      <p className="mt-0.5 text-[11px] text-neutral-900">{selectedNote.customerName}</p>
                    </div>
                    <div className="hidden">
                      <p className="font-semibold uppercase tracking-[0.16em] text-neutral-500">N.I.F.</p>
                      <p className="mt-1 text-sm text-neutral-900">—</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Telefono</p>
                      <p className="mt-0.5 text-[11px] text-neutral-900">
                        {selectedNoteCustomer?.phone ?? selectedNoteCustomer?.email ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 border-b border-neutral-300 pb-3 text-[10px] text-neutral-700">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Albaran</p>
                        <p className="mt-0.5 text-[11px] text-neutral-900">{selectedNote.number}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Fecha</p>
                        <p className="mt-0.5 text-[11px] text-neutral-900">{formatDocumentDate(selectedNote.date)}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Cliente</p>
                        <p className="mt-0.5 text-[11px] text-neutral-900">{selectedNote.customerName}</p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Telefono</p>
                        <p className="mt-0.5 text-[11px] text-neutral-900">{selectedNoteCustomer?.phone ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Email</p>
                        <p className="mt-0.5 text-[11px] text-neutral-900">{selectedNoteCustomer?.email ?? "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Direccion</p>
                        <p className="mt-0.5 text-[11px] text-neutral-900">{selectedNoteCustomer?.address ?? "—"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto border border-neutral-300">
                    <div className="min-w-[332px] sm:min-w-[560px]">
                      <div className="grid grid-cols-[minmax(0,1fr)_10px_34px_40px] bg-neutral-100 px-1 py-1.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-neutral-600 sm:hidden">
                        <span>Desc.</span>
                        <span className="text-left -ml-1">U.</span>
                        <span className="text-right">P.</span>
                        <span className="text-right">Imp.</span>
                      </div>
                      <div className="hidden grid-cols-[minmax(0,1fr)_64px_88px_96px] bg-neutral-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600 sm:grid">
                        <span>Descripcion</span>
                        <span className="text-right">Unid.</span>
                        <span className="text-right">Precio</span>
                        <span className="text-right">Importe</span>
                      </div>
                      <div className="border-b border-neutral-300 px-1 py-1.5 text-[8px] font-medium text-neutral-700 sm:px-4 sm:py-2 sm:text-[11px]">
                        ALBARAN {selectedNote.number} FECHA {formatDocumentDate(selectedNote.date)}
                      </div>
                      <div className="divide-y divide-neutral-200">
                        {selectedNote.items.map((item, index) => (
                          <div key={`${selectedNote.id}-${index}`}>
                            <div className="grid grid-cols-[minmax(0,1fr)_10px_34px_40px] gap-0 px-1 py-1.5 text-[8px] leading-3 sm:hidden">
                              <div className="min-w-0 break-words pr-0">{buildDocumentItemDescription(item)}</div>
                              <div className="text-left -ml-1">{item.quantity}</div>
                              <div className="text-right">
                                {formatDocumentNumber(item.customUnitPrice ?? item.unitPrice)}
                              </div>
                              <div className="text-right font-medium">{formatDocumentNumber(item.totalPrice)}</div>
                            </div>
                            <div className="hidden grid-cols-[minmax(0,1fr)_64px_88px_96px] gap-3 px-4 py-2 text-[11px] leading-5 sm:grid">
                              <div className="min-w-0 break-words">{buildDocumentItemDescription(item)}</div>
                              <div className="text-right">{item.quantity}</div>
                              <div className="text-right">
                                {formatDocumentNumber(item.customUnitPrice ?? item.unitPrice)}
                              </div>
                              <div className="text-right font-medium">{formatDocumentNumber(item.totalPrice)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between border-t border-neutral-300 bg-neutral-50 px-1 py-1.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-neutral-700 sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.16em]">
                        <span>Suma y sigue</span>
                        <span>{formatDocumentNumber(selectedNote.totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                  {isNotesOpen ? (
                    <div className="mt-4 border border-neutral-300 px-3 py-3 text-sm text-neutral-800">
                      {selectedNote.notes ?? "Sin notas para este albaran."}
                    </div>
                  ) : null}
                  <div className="hidden divide-y divide-neutral-200">
                    {selectedNote.items.map((item, index) => (
                      <div className="px-3 py-2 sm:px-4 sm:py-3" key={`${selectedNote.id}-${index}`}>
                        <div className="flex items-start gap-2 sm:gap-3">
                          <span className="min-w-0 flex-1 text-[11px] leading-4 text-neutral-900 sm:text-[13px] sm:leading-5">
                            <span className="font-semibold">{item.description}</span>
                            <span className="text-neutral-500">
                              {" | "}
                              {item.color}
                              {formatArticleTexture(item.texture)
                                ? ` | ${formatArticleTexture(item.texture)}`
                                : ""}
                              {" | x"}
                              {item.quantity}
                              {item.pricingMode === "UNIT"
                                ? ` | U ${item.customUnitPrice?.toFixed(2) ?? item.unitPrice.toFixed(2)}€`
                                : ` | M ${formatMetersSummary(item.linearMeters)} | M2 ${formatSquareMetersSummary(item.squareMeters)}`}
                              {item.thickness != null ? " | G" : ""}
                              {item.primer ? " | I" : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold text-neutral-900 sm:text-sm">
                            {formatCurrency(item.totalPrice)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-neutral-300 bg-white px-5 py-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                    Total
                  </p>
                  <p className="text-2xl font-bold text-neutral-900">
                    {formatCurrency(selectedNote.totalAmount)}
                  </p>
                </div>

                <button
                  className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold ${
                    selectedNote.status === "REVIEWED"
                      ? "border border-neutral-300 bg-white text-neutral-700"
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

          <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col border border-neutral-300 bg-white sm:inset-6">
            <div className="border-b border-neutral-300 bg-white px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    {editingNoteId ? "Editar albaran" : "Nuevo albaran"}
                  </p>
                </div>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center border border-neutral-300 bg-white text-neutral-600"
                  onClick={closeComposer}
                  type="button"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4" ref={composerContentRef}>
              <div className="grid gap-4 xl:grid-cols-[0.74fr_1.26fr]">
                <section className="space-y-3">
                  <div className={`border bg-white p-3 sm:p-4 ${customerStepReady ? "border-[var(--epx-accent)]/35" : "border-neutral-300"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                          Paso 1
                        </p>
                        <h4 className="mt-1 text-base font-semibold text-neutral-900">Cliente</h4>
                      </div>
                      {selectedCustomer ? (
                        <span className="border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] px-2 py-1 text-[10px] font-semibold text-[var(--epx-accent)]">
                          Seleccionado
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-2">
                      {selectedCustomer ? (
                        <div className="border border-[var(--epx-accent)]/35 bg-[color:rgb(255_149_0_/_0.08)] px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900">{selectedCustomer.name}</p>
                              <p className="mt-1 text-xs text-neutral-500">
                                {selectedCustomer.phone ?? selectedCustomer.email ?? "Sin contacto"}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                className="border border-neutral-300 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-700"
                                onClick={() => {
                                  setForm((current) => ({ ...current, customerId: "" }));
                                  setCustomerSearch("");
                                }}
                                type="button"
                              >
                                Borrar
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                            onChange={(event) => setCustomerSearch(event.target.value)}
                            placeholder="Introduce un cliente"
                            value={customerSearch}
                          />

                          {filteredCustomerSuggestions.map((customer) => (
                            <button
                              className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-left text-sm text-neutral-900 transition-colors hover:border-[var(--epx-accent)]/30"
                              key={customer.id}
                              onClick={() => {
                                setForm((current) => ({ ...current, customerId: customer.id }));
                                setCustomerSearch("");
                              }}
                              type="button"
                            >
                              <p className="font-semibold">{customer.name}</p>
                              <p className="mt-1 text-xs text-neutral-500">
                                {customer.phone ?? customer.email ?? "Sin contacto"}
                              </p>
                            </button>
                          ))}

                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-neutral-300 bg-white p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                          Fecha
                        </p>
                        <p className="mt-2 text-sm font-semibold text-neutral-900">
                          {new Date(form.date).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                      <button
                        className="border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 sm:text-sm"
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

                <section className="space-y-3">
                  <div className={`border bg-white p-3 sm:p-4 ${itemsStepReady ? "border-[var(--epx-accent)]/35" : "border-neutral-300"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                          Paso 2
                        </p>
                        <h4 className="mt-1 text-base font-semibold text-neutral-900">Piezas del albaran</h4>
                      </div>
                      <button
                        className="inline-flex items-center gap-1 bg-[var(--epx-accent)] px-2 py-1.5 text-[11px] font-semibold text-[#131313] disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!selectedCustomer}
                        onClick={() => setSheetState({ index: null, mode: "create", open: true })}
                        type="button"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Anadir pieza
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {form.items.length ? (
                        form.items.map((item, index) => (
                          <article
                            className="border border-neutral-300 bg-white p-2.5 sm:p-3"
                            key={`draft-item-${index}`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] text-neutral-500 sm:text-[11px]">
                              <span className="min-w-0 flex-1 truncate font-semibold text-neutral-900">
                                <span className="truncate text-[10px] font-semibold text-neutral-900 sm:text-[11px]">
                                  {`${item.description || "Pieza pendiente"} · ${item.color || "Sin color"}${formatArticleTexture(item.texture) ? ` · ${formatArticleTexture(item.texture)}` : ""} · x${item.quantity}${item.pricingMode === "UNIT" ? ` · U ${item.customUnitPrice || "0"}` : ` · M ${item.linearMeters || "0"} · M2 ${item.squareMeters || "0"}`}${item.hasThickness ? " · G" : ""}${item.hasPrimer ? " · I" : ""}${item.saveAsSpecialPiece ? " · ESP" : ""}`}
                                </span>
                                <span className="hidden truncate text-[10px] text-neutral-500">
                                  {`${item.color || "Sin color"}${formatArticleTexture(item.texture) ? ` · ${formatArticleTexture(item.texture)}` : ""} · x${item.quantity}`}
                                </span>
                              </span>
                              <span className="shrink-0 text-[10px] font-semibold text-[var(--epx-accent)] sm:text-xs">
                                {getItemPreview(item, index, selectedCustomer)
                                  ? formatCurrency(getItemPreview(item, index, selectedCustomer)!.totalPrice)
                                  : "—"}
                              </span>
                            </div>
                            <div className="hidden mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                              {item.pricingMode === "UNIT" ? (
                                <span>U {item.customUnitPrice || "0"} €</span>
                              ) : (
                                <>
                                  <span>M {item.linearMeters || "0"}</span>
                                  <span>M2 {item.squareMeters || "0"}</span>
                                </>
                              )}
                              {item.hasThickness ? <span>Grosor</span> : null}
                              {item.hasPrimer ? <span>Imprimacion</span> : null}
                              {item.saveAsSpecialPiece ? <span>Guardar especial</span> : null}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700"
                                onClick={() => setSheetState({ index, mode: "edit", open: true })}
                                type="button"
                              >
                                <PencilSquareIcon className="h-3.5 w-3.5" />
                                Editar
                              </button>
                              <button
                                className="inline-flex items-center gap-1.5 border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-200"
                                onClick={() => removeItem(index)}
                                type="button"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                                Quitar
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="border border-dashed border-neutral-300 bg-white px-3 py-4 text-xs text-neutral-500 sm:px-4 sm:py-5 sm:text-sm">
                          Todavia no hay piezas. Anade la primera para continuar.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-neutral-300 bg-white p-3 sm:p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                      Paso 3
                    </p>
                    <h4 className="mt-1 text-base font-semibold text-neutral-900">Revision final</h4>
                    <textarea
                      className="mt-3 min-h-24 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      placeholder="Notas del trabajo"
                      value={form.notes}
                    />

                    {formError || mutationError ? (
                      <p className="mt-3 border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
                        {formError ?? mutationError}
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-neutral-300 bg-white px-3 py-3 sm:px-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Total del albaran
                </p>
                <p className="text-xl font-bold text-neutral-900 sm:text-2xl">{formatCurrency(liveTotal)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="border border-neutral-300 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-700 sm:text-sm"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  onClick={() => void submitForm("DRAFT")}
                  type="button"
                >
                  Guardar borrador
                </button>
                <button
                  className="inline-flex items-center gap-1.5 bg-[var(--epx-accent)] px-3 py-2.5 text-xs font-semibold text-[#131313] sm:gap-2 sm:text-sm"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  onClick={() => void submitForm("PENDING")}
                  type="button"
                >
                  <CheckCircleIcon className="h-4 w-4" />
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
