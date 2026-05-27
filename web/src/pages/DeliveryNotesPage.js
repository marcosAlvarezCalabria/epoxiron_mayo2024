import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowLeftIcon, CalendarDaysIcon, CheckCircleIcon, MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { calculatePricePreview, createDeliveryNote, deleteDeliveryNote, getCustomers, getDeliveryNotes, updateDeliveryNote, updateDeliveryNoteStatus } from "@/application/use-cases";
import { ApiError } from "@/infrastructure/api/apiClient";
const badgeByStatus = {
    DRAFT: "text-gray-300 bg-white/5",
    PENDING: "text-amber-200 bg-amber-500/10 border border-amber-500/20",
    REVIEWED: "text-emerald-200 bg-emerald-500/10 border border-emerald-500/20"
};
const statusLabel = {
    DRAFT: "Borrador",
    PENDING: "Pendiente",
    REVIEWED: "Revisado"
};
const statusHelp = {
    DRAFT: "Todavia se esta preparando. Se puede editar y borrar.",
    PENDING: "Ya esta preparado, pero falta comprobarlo antes de darlo por bueno.",
    REVIEWED: "Ya esta revisado y validado para dejarlo cerrado."
};
const quickRalColors = [
    "RAL 7016",
    "RAL 9005",
    "RAL 9010",
    "RAL 6005",
    "RAL 3009",
    "RAL 5008"
];
const genericItemTemplates = [
    "Perfil rectangular",
    "Marco soldado",
    "Rejilla exterior",
    "Pletina mecanizada",
    "Bastidor auxiliar",
    "Caja de registro"
];
const emptyItem = () => ({
    description: "",
    color: quickRalColors[0],
    linearMeters: "",
    squareMeters: "",
    thickness: "",
    quantity: "1"
});
const emptyForm = () => ({
    customerId: "",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
    items: [emptyItem()]
});
const noteToFormState = (note) => ({
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
const parseOptionalNumber = (value) => {
    const trimmed = value.trim();
    return trimmed ? Number.parseFloat(trimmed) : null;
};
const normalizeItem = (item) => ({
    description: item.description.trim(),
    color: item.color.trim(),
    linearMeters: parseOptionalNumber(item.linearMeters),
    squareMeters: parseOptionalNumber(item.squareMeters),
    thickness: parseOptionalNumber(item.thickness),
    quantity: Number.parseInt(item.quantity || "1", 10)
});
const normalizePayload = (form, status) => ({
    customerId: form.customerId,
    notes: form.notes.trim() ? form.notes.trim() : null,
    status,
    date: new Date(form.date).toISOString(),
    items: form.items.map(normalizeItem)
});
const canPreviewItem = (customerId, item) => Boolean(customerId &&
    item.description.trim() &&
    item.color.trim() &&
    Number.parseInt(item.quantity || "0", 10) > 0);
export const DeliveryNotesPage = () => {
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [selectedNoteId, setSelectedNoteId] = useState(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [mobilePane, setMobilePane] = useState("list");
    const [form, setForm] = useState(emptyForm);
    const [customerSearch, setCustomerSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [customerFilter, setCustomerFilter] = useState("");
    const [todayOnly, setTodayOnly] = useState(false);
    const [formError, setFormError] = useState(null);
    const [previews, setPreviews] = useState({});
    const customersQuery = useQuery({
        queryKey: ["customers", "all-for-delivery-notes"],
        queryFn: () => getCustomers()
    });
    const deliveryNotesQuery = useQuery({
        queryKey: ["delivery-notes", statusFilter, customerFilter, todayOnly],
        queryFn: () => getDeliveryNotes({
            status: statusFilter,
            customerId: customerFilter || undefined,
            today: todayOnly
        })
    });
    const selectedCustomer = customersQuery.data?.customers.find((customer) => customer.id === form.customerId) ?? null;
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
    const selectedNote = deliveryNotesQuery.data?.deliveryNotes.find((note) => note.id === selectedNoteId) ??
        deliveryNotesQuery.data?.deliveryNotes[0] ??
        null;
    const requestedNoteId = searchParams.get("noteId");
    useEffect(() => {
        if (!requestedNoteId || !deliveryNotesQuery.data?.deliveryNotes.length) {
            return;
        }
        const requestedNote = deliveryNotesQuery.data.deliveryNotes.find((note) => note.id === requestedNoteId);
        if (!requestedNote) {
            return;
        }
        setSelectedNoteId(requestedNote.id);
        setMobilePane("detail");
    }, [deliveryNotesQuery.data?.deliveryNotes, requestedNoteId]);
    const createMutation = useMutation({
        mutationFn: createDeliveryNote,
        onSuccess: async (result) => {
            setEditingNoteId(null);
            setSelectedNoteId(result.deliveryNote.id);
            setForm(emptyForm());
            setCustomerSearch("");
            setFormError(null);
            setIsComposerOpen(false);
            setPreviews({});
            await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
            await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        }
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, input }) => updateDeliveryNote(id, input),
        onSuccess: async (result) => {
            setEditingNoteId(null);
            setSelectedNoteId(result.deliveryNote.id);
            setForm(emptyForm());
            setCustomerSearch("");
            setFormError(null);
            setIsComposerOpen(false);
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
        mutationFn: ({ id, status }) => updateDeliveryNoteStatus(id, status),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
            await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        }
    });
    const mutationError = useMemo(() => {
        const error = createMutation.error ?? updateMutation.error ?? deleteMutation.error ?? statusMutation.error;
        return error instanceof ApiError ? error.message : null;
    }, [createMutation.error, deleteMutation.error, statusMutation.error, updateMutation.error]);
    const liveTotal = useMemo(() => Object.values(previews).reduce((sum, preview) => sum + preview.totalPrice, 0), [previews]);
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
            void Promise.all(activeEntries.map(async ({ item, index }) => {
                const result = await calculatePricePreview(form.customerId, normalizeItem(item));
                return { index, preview: result.pricing };
            }))
                .then((results) => {
                startTransition(() => {
                    setPreviews(results.reduce((accumulator, entry) => {
                        accumulator[entry.index] = entry.preview;
                        return accumulator;
                    }, {}));
                });
            })
                .catch(() => {
                startTransition(() => setPreviews({}));
            });
        }, 220);
        return () => window.clearTimeout(timeout);
    }, [form]);
    const submitForm = async (status) => {
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
            }
            else {
                await createMutation.mutateAsync(payload);
            }
        }
        catch {
            return;
        }
    };
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-400", children: "Operacion diaria" }), _jsx("h2", { className: "text-3xl font-semibold tracking-tight text-white", children: "Cola de albaranes" }), _jsx("p", { className: "mt-2 max-w-2xl text-sm text-slate-400", children: "Registro agil de trabajos con seleccion de cliente, calculo inmediato y numeracion automatica." })] }), _jsxs("button", { className: "inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50", onClick: () => {
                            setEditingNoteId(null);
                            setForm(emptyForm());
                            setCustomerSearch("");
                            setPreviews({});
                            setFormError(null);
                            setMobilePane("detail");
                            setIsComposerOpen(true);
                        }, type: "button", children: [_jsx(PlusIcon, { className: "h-5 w-5" }), "Nuevo albaran"] })] }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-[0.88fr_1.12fr]", children: [_jsxs("div", { className: `order-2 space-y-4 xl:order-1 ${mobilePane === "detail" ? "hidden xl:block" : "block"}`, children: [_jsx("div", { className: "rounded-2xl border border-white/10 bg-slate-900/70 p-4", children: _jsxs("div", { className: "grid gap-3", children: [_jsx("div", { className: "flex flex-wrap gap-2", children: ["ALL", "DRAFT", "PENDING", "REVIEWED"].map((value) => (_jsx("button", { className: `rounded-full px-3 py-2 text-sm font-semibold ${statusFilter === value
                                                    ? "bg-cyan-500 text-gray-950"
                                                    : "border border-white/10 bg-gray-950/50 text-gray-300"}`, onClick: () => setStatusFilter(value), type: "button", children: value === "ALL" ? "Todos" : statusLabel[value] }, value))) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { className: `rounded-full px-3 py-2 text-sm font-semibold ${todayOnly
                                                        ? "bg-amber-400 text-gray-950"
                                                        : "border border-white/10 bg-gray-950/50 text-gray-300"}`, onClick: () => setTodayOnly((current) => !current), type: "button", children: "Hoy" }), _jsxs("select", { className: "min-w-52 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white", onChange: (event) => setCustomerFilter(event.target.value), value: customerFilter, children: [_jsx("option", { value: "", children: "Todos los clientes" }), customersQuery.data?.customers.map((customer) => (_jsx("option", { value: customer.id, children: customer.name }, customer.id)))] })] }), _jsxs("div", { className: "grid gap-2 border-t border-white/10 pt-3 text-sm text-slate-300", children: [_jsx("p", { className: "font-semibold text-white", children: "Como se usan los estados" }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold text-white", children: "Borrador:" }), " aun lo estas preparando."] }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold text-white", children: "Pendiente:" }), " ya esta hecho, pero falta revisarlo."] }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold text-white", children: "Revisado:" }), " ya esta comprobado y cerrado."] })] })] }) }), _jsx("div", { className: "space-y-3", children: deliveryNotesQuery.data?.deliveryNotes.length ? (deliveryNotesQuery.data.deliveryNotes.map((note) => (_jsxs("button", { className: `w-full rounded-2xl border p-4 text-left transition-colors ${selectedNote?.id === note.id
                                        ? "border-cyan-400/30 bg-cyan-400/10"
                                        : "border-white/10 bg-slate-900/70 hover:border-white/20"}`, onClick: () => {
                                        setSelectedNoteId(note.id);
                                        setMobilePane("detail");
                                    }, type: "button", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-base font-semibold text-white", children: note.number }), _jsx("p", { className: "mt-1 text-sm text-gray-400", children: note.customerName })] }), _jsx("span", { className: `rounded-full px-3 py-1 text-xs font-semibold ${badgeByStatus[note.status]}`, children: statusLabel[note.status] })] }), _jsxs("div", { className: "mt-3 flex items-center justify-between text-sm", children: [_jsxs("span", { className: "text-gray-500", children: [note.items.length, " lineas \u00B7 ", new Date(note.date).toLocaleDateString("es-ES")] }), _jsxs("span", { className: "font-mono text-cyan-300", children: [note.totalAmount.toFixed(2), " \u20AC"] })] })] }, note.id)))) : (_jsx("div", { className: "rounded-3xl border border-dashed border-white/10 p-8 text-sm text-gray-500", children: "No hay albaranes para este filtro." })) })] }), _jsxs("div", { className: `order-1 space-y-4 xl:order-2 ${mobilePane === "list" ? "hidden xl:block" : "block"}`, children: [selectedNote ? (_jsxs("article", { className: "rounded-2xl border border-white/10 bg-slate-900/70 p-5", children: [_jsxs("button", { className: "mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white xl:hidden", onClick: () => setMobilePane("list"), type: "button", children: [_jsx(ArrowLeftIcon, { className: "h-4 w-4" }), "Volver a la lista"] }), _jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-400", children: "Ficha activa" }), _jsx("h3", { className: "mt-1 text-2xl font-semibold text-white", children: selectedNote.number }), _jsx("p", { className: "mt-2 text-sm text-gray-400", children: selectedNote.customerName })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 sm:flex", children: [_jsx("button", { className: "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white", onClick: () => {
                                                            setEditingNoteId(selectedNote.id);
                                                            setForm(noteToFormState(selectedNote));
                                                            setCustomerSearch(selectedNote.customerName);
                                                            setFormError(null);
                                                            setPreviews({});
                                                            setIsComposerOpen(true);
                                                        }, type: "button", children: "Editar" }), selectedNote.status !== "REVIEWED" ? (_jsx("button", { className: "rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200", onClick: () => statusMutation.mutate({ id: selectedNote.id, status: "REVIEWED" }), type: "button", children: "Revisado" })) : null, selectedNote.status === "DRAFT" ? (_jsx("button", { className: "rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200", onClick: () => {
                                                            if (window.confirm(`Eliminar albaran ${selectedNote.number}?`)) {
                                                                deleteMutation.mutate(selectedNote.id);
                                                            }
                                                        }, type: "button", children: "Eliminar" })) : null] })] }), _jsxs("div", { className: "mt-5 grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl border border-white/10 bg-gray-950/50 p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Estado" }), _jsx("p", { className: "mt-2 text-xl font-bold text-white", children: statusLabel[selectedNote.status] }), _jsx("p", { className: "mt-2 text-sm text-slate-400", children: statusHelp[selectedNote.status] })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-gray-950/50 p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Fecha" }), _jsx("p", { className: "mt-2 text-xl font-bold text-white", children: new Date(selectedNote.date).toLocaleDateString("es-ES") })] }), _jsxs("div", { className: "rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200", children: "Total" }), _jsxs("p", { className: "mt-2 text-xl font-bold text-cyan-100", children: [selectedNote.totalAmount.toFixed(2), " \u20AC"] })] })] }), _jsx("div", { className: "mt-5 space-y-3", children: selectedNote.items.map((item, index) => (_jsx("div", { className: "rounded-2xl border border-white/10 bg-gray-950/50 p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-white", children: item.description }), _jsxs("p", { className: "mt-1 text-sm text-gray-400", children: [item.color, " \u00B7 x", item.quantity] })] }), _jsxs("span", { className: "font-mono text-sm text-cyan-300", children: [item.totalPrice.toFixed(2), " \u20AC"] })] }) }, `${selectedNote.id}-${index}`))) })] })) : null, isComposerOpen ? (_jsxs("div", { className: "fixed inset-0 z-40 flex items-end bg-gray-950/75 backdrop-blur sm:items-center sm:justify-center", children: [_jsx("button", { "aria-label": "Cerrar formulario de albaran", className: "absolute inset-0", onClick: () => {
                                            setEditingNoteId(null);
                                            setForm(emptyForm());
                                            setCustomerSearch("");
                                            setPreviews({});
                                            setFormError(null);
                                            setIsComposerOpen(false);
                                        }, type: "button" }), _jsxs("form", { className: "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0b1220] p-5 shadow-2xl shadow-cyan-950/40 sm:max-w-5xl sm:rounded-[2rem] sm:p-6", onSubmit: (event) => {
                                            event.preventDefault();
                                            void submitForm(editingNoteId ? "PENDING" : "DRAFT");
                                        }, children: [_jsxs("div", { className: "sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1220]/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-cyan-300", children: editingNoteId ? "Editar albaran" : "Alta rapida" }), _jsx("h3", { className: "mt-1 text-xl font-bold text-white", children: editingNoteId ? "Actualizar trabajo" : "Nuevo trabajo" })] }), _jsx("button", { className: "rounded-2xl border border-white/10 px-4 py-2 text-sm text-gray-300", onClick: () => {
                                                            setEditingNoteId(null);
                                                            setForm(emptyForm());
                                                            setCustomerSearch("");
                                                            setPreviews({});
                                                            setFormError(null);
                                                            setIsComposerOpen(false);
                                                        }, type: "button", children: "Cerrar" })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("label", { className: "rounded-2xl border border-white/10 bg-gray-950/50 px-4 py-3", children: [_jsx("span", { className: "mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Fecha" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(CalendarDaysIcon, { className: "h-5 w-5 text-cyan-300" }), _jsx("input", { className: "w-full bg-transparent text-sm text-white outline-none", onChange: (event) => setForm((current) => ({ ...current, date: event.target.value })), type: "date", value: form.date })] })] }), _jsxs("div", { className: "rounded-2xl border border-dashed border-white/10 bg-gray-950/40 px-4 py-3 text-sm text-gray-400", children: ["Numero automatico al guardar:", _jsx("div", { className: "mt-2 font-mono text-cyan-200", children: "ALB-YYYY-NNNN" })] })] }), _jsxs("div", { children: [_jsx("p", { className: "mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Cliente" }), _jsx("input", { className: "w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", onChange: (event) => {
                                                            setCustomerSearch(event.target.value);
                                                            setForm((current) => ({ ...current, customerId: "" }));
                                                        }, placeholder: "Escribe la primera letra del cliente", value: customerSearch }), filteredCustomerSuggestions.length ? (_jsx("div", { className: "mt-3 overflow-hidden rounded-2xl border border-white/10 bg-gray-950/75", children: filteredCustomerSuggestions.map((customer) => (_jsxs("button", { className: "flex w-full items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left text-sm text-white last:border-b-0 hover:bg-white/5", onClick: () => {
                                                                setForm((current) => ({ ...current, customerId: customer.id }));
                                                                setCustomerSearch(customer.name);
                                                            }, type: "button", children: [_jsx("span", { className: "font-medium", children: customer.name }), _jsxs("span", { className: "text-xs text-gray-500", children: [customer.specialPieces.length, " piezas"] })] }, customer.id))) })) : null] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Items" }), _jsx("p", { className: "text-sm text-gray-500", children: "Menos escritura, mas toque." })] }), _jsxs("button", { className: "inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-white", onClick: () => setForm((current) => ({
                                                                    ...current,
                                                                    items: [...current.items, emptyItem()]
                                                                })), type: "button", children: [_jsx(PlusIcon, { className: "h-4 w-4" }), "Item"] })] }), form.items.map((item, index) => (_jsxs("div", { className: "space-y-4 rounded-3xl border border-white/10 bg-gray-950/50 p-4", children: [_jsx("div", { className: "flex flex-wrap gap-2", children: [...(selectedCustomer?.specialPieces.map((piece) => piece.name) ?? []), ...genericItemTemplates]
                                                                    .slice(0, 8)
                                                                    .map((template) => (_jsx("button", { className: `rounded-full px-3 py-2 text-sm ${item.description === template
                                                                        ? "bg-cyan-500 text-gray-950"
                                                                        : "border border-white/10 bg-gray-900 text-gray-300"}`, onClick: () => setForm((current) => ({
                                                                        ...current,
                                                                        items: current.items.map((entry, entryIndex) => entryIndex === index
                                                                            ? { ...entry, description: template }
                                                                            : entry)
                                                                    })), type: "button", children: template }, `${index}-${template}`))) }), _jsx("input", { className: "w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", onChange: (event) => setForm((current) => ({
                                                                    ...current,
                                                                    items: current.items.map((entry, entryIndex) => entryIndex === index
                                                                        ? { ...entry, description: event.target.value }
                                                                        : entry)
                                                                })), placeholder: "Descripcion", value: item.description }), _jsx("div", { className: "flex flex-wrap gap-2", children: quickRalColors.map((color) => (_jsx("button", { className: `rounded-full px-3 py-2 text-sm ${item.color === color
                                                                        ? "bg-cyan-500 text-gray-950"
                                                                        : "border border-white/10 bg-gray-900 text-gray-300"}`, onClick: () => setForm((current) => ({
                                                                        ...current,
                                                                        items: current.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, color } : entry)
                                                                    })), type: "button", children: color }, `${index}-${color}`))) }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-[132px_1fr_1fr_1fr]", children: [_jsxs("div", { className: "rounded-2xl border border-white/10 bg-gray-950/60 p-2", children: [_jsx("p", { className: "px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400", children: "Cantidad" }), _jsxs("div", { className: "mt-2 flex items-center justify-between", children: [_jsx("button", { className: "rounded-xl border border-white/10 p-2 text-gray-300", onClick: () => setForm((current) => ({
                                                                                            ...current,
                                                                                            items: current.items.map((entry, entryIndex) => {
                                                                                                if (entryIndex !== index) {
                                                                                                    return entry;
                                                                                                }
                                                                                                const next = Math.max(1, Number.parseInt(entry.quantity || "1", 10) - 1);
                                                                                                return { ...entry, quantity: next.toString() };
                                                                                            })
                                                                                        })), type: "button", children: _jsx(MinusIcon, { className: "h-4 w-4" }) }), _jsx("span", { className: "text-lg font-bold text-white", children: item.quantity }), _jsx("button", { className: "rounded-xl border border-white/10 p-2 text-gray-300", onClick: () => setForm((current) => ({
                                                                                            ...current,
                                                                                            items: current.items.map((entry, entryIndex) => {
                                                                                                if (entryIndex !== index) {
                                                                                                    return entry;
                                                                                                }
                                                                                                const next = Number.parseInt(entry.quantity || "1", 10) + 1;
                                                                                                return { ...entry, quantity: next.toString() };
                                                                                            })
                                                                                        })), type: "button", children: _jsx(PlusIcon, { className: "h-4 w-4" }) })] })] }), [
                                                                        { key: "linearMeters", label: "ML" },
                                                                        { key: "squareMeters", label: "M2" },
                                                                        { key: "thickness", label: "Grosor" }
                                                                    ].map((field) => (_jsxs("label", { className: "rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3", children: [_jsx("span", { className: "block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400", children: field.label }), _jsx("input", { className: "mt-2 w-full bg-transparent text-sm text-white outline-none", inputMode: "decimal", onChange: (event) => setForm((current) => ({
                                                                                    ...current,
                                                                                    items: current.items.map((entry, entryIndex) => entryIndex === index
                                                                                        ? { ...entry, [field.key]: event.target.value }
                                                                                        : entry)
                                                                                })), placeholder: "0", value: item[field.key] })] }, `${index}-${field.key}`)))] }), _jsxs("div", { className: "flex items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-cyan-100", children: previews[index]
                                                                                    ? `Total item ${previews[index].totalPrice.toFixed(2)} €`
                                                                                    : "Completa cliente, descripcion y color para ver precio" }), previews[index] ? (_jsxs("p", { className: "mt-1 text-cyan-200/80", children: ["Unitario ", previews[index].unitPrice.toFixed(2), " \u20AC"] })) : null] }), form.items.length > 1 ? (_jsx("button", { className: "rounded-2xl border border-white/10 px-3 py-2 text-gray-200", onClick: () => setForm((current) => ({
                                                                            ...current,
                                                                            items: current.items.filter((_, entryIndex) => entryIndex !== index)
                                                                        })), type: "button", children: "Quitar" })) : null] })] }, `item-${index}`)))] }), _jsx("textarea", { className: "min-h-24 w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", onChange: (event) => setForm((current) => ({ ...current, notes: event.target.value })), placeholder: "Notas del trabajo", value: form.notes }), formError || mutationError ? (_jsx("p", { className: "rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200", children: formError ?? mutationError })) : null, _jsxs("div", { className: "sticky bottom-0 rounded-3xl border border-white/10 bg-gray-950/90 p-3 backdrop-blur", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Resumen rapido" }), _jsxs("p", { className: "mt-1 text-lg font-bold text-cyan-200", children: [liveTotal.toFixed(2), " \u20AC"] })] }), selectedCustomer ? (_jsx("div", { className: "rounded-full bg-white/5 px-3 py-2 text-xs text-gray-300", children: selectedCustomer.name })) : null] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx("button", { className: "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white", onClick: () => void submitForm("DRAFT"), type: "button", children: "Guardar borrador" }), _jsxs("button", { className: "inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-gray-950", onClick: () => void submitForm("PENDING"), type: "button", children: [_jsx(CheckCircleIcon, { className: "h-5 w-5" }), "Marcar pendiente"] })] })] })] })] })) : (_jsx("div", { className: "rounded-3xl border border-dashed border-white/10 p-8 text-sm text-gray-500", children: "Selecciona un albaran o crea uno nuevo para trabajar rapido desde el movil." }))] })] })] }));
};
