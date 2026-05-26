import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState, startTransition } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calculatePricePreview, createDeliveryNote, deleteDeliveryNote, getCustomers, getDeliveryNotes, updateDeliveryNote, updateDeliveryNoteStatus } from "@/application/use-cases";
import { ApiError } from "@/infrastructure/api/apiClient";
const badgeByStatus = {
    DRAFT: "bg-gray-700 text-gray-300",
    PENDING: "border border-yellow-700/50 bg-yellow-900/30 text-yellow-400",
    REVIEWED: "border border-green-700/50 bg-green-900/30 text-green-400"
};
const emptyItem = () => ({
    description: "",
    color: "",
    linearMeters: "",
    squareMeters: "",
    thickness: "",
    quantity: "1"
});
const emptyForm = () => ({
    number: "",
    customerId: "",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
    items: [emptyItem()]
});
const noteToFormState = (note) => ({
    number: note.number,
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
    number: form.number.trim(),
    customerId: form.customerId,
    notes: form.notes.trim() ? form.notes.trim() : null,
    status,
    date: new Date(form.date).toISOString(),
    items: form.items.map(normalizeItem)
});
const canPreviewItem = (customerId, item) => Boolean(customerId && item.description.trim() && item.color.trim() && Number.parseInt(item.quantity || "0", 10) > 0);
export const DeliveryNotesPage = () => {
    const queryClient = useQueryClient();
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [form, setForm] = useState(emptyForm);
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
    const createMutation = useMutation({
        mutationFn: createDeliveryNote,
        onSuccess: async () => {
            setEditingNoteId(null);
            setForm(emptyForm());
            setPreviews({});
            await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
            await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        }
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, input }) => updateDeliveryNote(id, input),
        onSuccess: async () => {
            setEditingNoteId(null);
            setForm(emptyForm());
            setPreviews({});
            await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
            await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        }
    });
    const deleteMutation = useMutation({
        mutationFn: deleteDeliveryNote,
        onSuccess: async () => {
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
                return {
                    index,
                    preview: result.pricing
                };
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
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [form]);
    const submitForm = async (status) => {
        setFormError(null);
        if (!form.number.trim()) {
            setFormError("El número de albarán es obligatorio.");
            return;
        }
        if (!form.customerId) {
            setFormError("Selecciona un cliente.");
            return;
        }
        if (form.items.some((item) => !item.description.trim() || !item.color.trim())) {
            setFormError("Todos los items deben tener descripción y color.");
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
    return (_jsxs("section", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-100", children: "Albaranes" }), _jsx("p", { className: "text-sm text-gray-400", children: "CRUD operativo con preview de precio desde la API." })] }), _jsxs("div", { className: "grid gap-8 xl:grid-cols-[1.1fr_0.9fr]", children: [_jsxs("div", { className: "space-y-6 rounded-2xl border border-gray-700 bg-gray-800/60 p-6", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-bold text-gray-100", children: editingNoteId ? "Editar albarán" : "Nuevo albarán" }), _jsx("p", { className: "text-sm text-gray-400", children: "La API recalcula todos los importes al guardar." })] }), editingNoteId ? (_jsx("button", { className: "rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300", onClick: () => {
                                            setEditingNoteId(null);
                                            setForm(emptyForm());
                                            setPreviews({});
                                            setFormError(null);
                                        }, type: "button", children: "Cancelar edici\u00F3n" })) : null] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "N\u00FAmero" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({ ...current, number: event.target.value })), value: form.number })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Fecha" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({ ...current, date: event.target.value })), type: "date", value: form.date })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Cliente" }), _jsxs("select", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({ ...current, customerId: event.target.value })), value: form.customerId, children: [_jsx("option", { value: "", children: "Selecciona un cliente" }), customersQuery.data?.customers.map((customer) => (_jsx("option", { value: customer.id, children: customer.name }, customer.id)))] })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Notas" }), _jsx("textarea", { className: "min-h-24 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({ ...current, notes: event.target.value })), value: form.notes })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-bold uppercase tracking-wider text-gray-300", children: "Items" }), _jsx("p", { className: "text-sm text-gray-400", children: "Preview unitario y total por item." })] }), _jsx("button", { className: "rounded-lg border border-blue-700/50 bg-blue-900/20 px-3 py-2 text-sm text-blue-200", onClick: () => setForm((current) => ({
                                                    ...current,
                                                    items: [...current.items, emptyItem()]
                                                })), type: "button", children: "A\u00F1adir item" })] }), form.items.map((item, index) => (_jsxs("div", { className: "space-y-3 rounded-2xl border border-gray-700 bg-gray-900/40 p-4", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx("input", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({
                                                            ...current,
                                                            items: current.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, description: event.target.value } : entry)
                                                        })), placeholder: "Descripci\u00F3n", value: item.description }), _jsx("input", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({
                                                            ...current,
                                                            items: current.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, color: event.target.value } : entry)
                                                        })), placeholder: "Color RAL", value: item.color })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-4", children: [_jsx("input", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", inputMode: "numeric", onChange: (event) => setForm((current) => ({
                                                            ...current,
                                                            items: current.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: event.target.value } : entry)
                                                        })), placeholder: "Cantidad", value: item.quantity }), _jsx("input", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", inputMode: "decimal", onChange: (event) => setForm((current) => ({
                                                            ...current,
                                                            items: current.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, linearMeters: event.target.value } : entry)
                                                        })), placeholder: "ML", value: item.linearMeters }), _jsx("input", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", inputMode: "decimal", onChange: (event) => setForm((current) => ({
                                                            ...current,
                                                            items: current.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, squareMeters: event.target.value } : entry)
                                                        })), placeholder: "M\u00B2", value: item.squareMeters }), _jsx("input", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", inputMode: "decimal", onChange: (event) => setForm((current) => ({
                                                            ...current,
                                                            items: current.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, thickness: event.target.value } : entry)
                                                        })), placeholder: "Grosor", value: item.thickness })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-sm text-gray-400", children: previews[index] ? (_jsxs("span", { className: "font-mono text-blue-300", children: ["Unit. ", previews[index].unitPrice.toFixed(2), "\u20AC \u00B7 Total ", previews[index].totalPrice.toFixed(2), "\u20AC"] })) : (_jsx("span", { children: "Sin preview todav\u00EDa" })) }), form.items.length > 1 ? (_jsx("button", { className: "rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300", onClick: () => setForm((current) => ({
                                                            ...current,
                                                            items: current.items.filter((_, entryIndex) => entryIndex !== index)
                                                        })), type: "button", children: "Quitar item" })) : null] })] }, `item-${index}`)))] }), formError || mutationError ? (_jsx("p", { className: "rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300", children: formError ?? mutationError })) : null, _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { className: "rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-100", onClick: () => void submitForm("DRAFT"), type: "button", children: "Guardar borrador" }), _jsx("button", { className: "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white", onClick: () => void submitForm("PENDING"), type: "button", children: "Marcar pendiente" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "rounded-2xl border border-gray-700 bg-gray-800/60 p-5", children: [_jsx("h3", { className: "text-lg font-bold text-gray-100", children: "Filtros" }), _jsxs("div", { className: "mt-4 grid gap-3", children: [_jsxs("select", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setStatusFilter(event.target.value), value: statusFilter, children: [_jsx("option", { value: "ALL", children: "Todos los estados" }), _jsx("option", { value: "DRAFT", children: "Borrador" }), _jsx("option", { value: "PENDING", children: "Pendiente" }), _jsx("option", { value: "REVIEWED", children: "Revisado" })] }), _jsxs("select", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setCustomerFilter(event.target.value), value: customerFilter, children: [_jsx("option", { value: "", children: "Todos los clientes" }), customersQuery.data?.customers.map((customer) => (_jsx("option", { value: customer.id, children: customer.name }, customer.id)))] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-300", children: [_jsx("input", { checked: todayOnly, onChange: () => setTodayOnly((current) => !current), type: "checkbox" }), "Solo hoy"] })] })] }), deliveryNotesQuery.data?.deliveryNotes.map((note) => (_jsxs("article", { className: "rounded-2xl border border-gray-700 bg-gray-800 p-5", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-lg font-bold text-gray-100", children: note.number }), _jsx("p", { className: "text-sm text-gray-400", children: note.customerName })] }), _jsx("span", { className: `rounded-full px-3 py-1 text-xs font-semibold ${badgeByStatus[note.status]}`, children: note.status })] }), _jsxs("div", { className: "mt-4 flex items-center justify-between text-sm text-gray-400", children: [_jsx("span", { children: new Date(note.date).toLocaleDateString("es-ES") }), _jsxs("span", { className: "font-mono text-blue-400", children: [note.totalAmount.toFixed(2), "\u20AC"] })] }), _jsx("div", { className: "mt-4 space-y-2 rounded-xl border border-gray-700 bg-gray-900/30 p-3", children: note.items.map((item, index) => (_jsxs("div", { className: "flex items-center justify-between text-sm text-gray-300", children: [_jsxs("span", { children: [item.description, " \u00B7 ", item.color, " \u00B7 x", item.quantity] }), _jsxs("span", { className: "font-mono text-gray-400", children: [item.totalPrice.toFixed(2), "\u20AC"] })] }, `${note.id}-${index}`))) }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2", children: [_jsx("button", { className: "rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300", onClick: () => {
                                                    setEditingNoteId(note.id);
                                                    setForm(noteToFormState(note));
                                                    setFormError(null);
                                                }, type: "button", children: "Editar" }), note.status !== "REVIEWED" ? (_jsx("button", { className: "rounded-lg border border-green-700/50 bg-green-900/20 px-3 py-2 text-sm text-green-300", onClick: () => statusMutation.mutate({ id: note.id, status: "REVIEWED" }), type: "button", children: "Marcar revisado" })) : null, note.status === "DRAFT" ? (_jsx("button", { className: "rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300", onClick: () => {
                                                    if (window.confirm(`Eliminar albarán ${note.number}?`)) {
                                                        deleteMutation.mutate(note.id);
                                                    }
                                                }, type: "button", children: "Eliminar" })) : null] })] }, note.id)))] })] })] }));
};
