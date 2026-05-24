import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { useHermesStore } from "@/features/hermes/store/hermesStore";
import { useHermesSession } from "@/features/hermes/hooks/useHermesSession";
import { useHermesTasks } from "@/features/hermes/hooks/useHermesTasks";
import { HermesProposalCard } from "@/features/hermes/components/HermesProposalCard";
export const HermesPanel = () => {
    const { isOpen, toggleOpen, activeTab, setTab } = useHermesStore();
    const [sessionId, setSessionId] = useState();
    const [message, setMessage] = useState("");
    const { sessionQuery, createSessionMutation, sendMessageMutation, confirmProposalMutation, rejectProposalMutation } = useHermesSession(sessionId);
    const tasksQuery = useHermesTasks();
    useEffect(() => {
        if (!sessionId && isOpen && !createSessionMutation.isPending) {
            void createSessionMutation.mutateAsync().then((session) => {
                setSessionId(session.sessionId);
            });
        }
    }, [createSessionMutation, isOpen, sessionId]);
    const session = sessionQuery.data;
    return (_jsxs(_Fragment, { children: [_jsx("button", { className: "fixed bottom-6 right-6 z-40 rounded-full bg-blue-600 p-4 text-white shadow-lg hover:bg-blue-500", onClick: toggleOpen, type: "button", children: _jsx(SparklesIcon, { className: "h-6 w-6" }) }), _jsxs("aside", { className: clsx("fixed right-0 top-0 z-30 flex h-screen w-full max-w-md flex-col border-l border-gray-700 bg-gray-800 shadow-2xl transition-transform duration-300", isOpen ? "translate-x-0" : "translate-x-full"), children: [_jsxs("header", { className: "border-b border-gray-700 bg-gray-900 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-bold text-gray-100", children: "Hermes" }), _jsx("p", { className: "text-sm text-gray-400", children: "Agente operativo de Epoxiron" })] }), _jsx("button", { className: "text-sm text-gray-400", onClick: toggleOpen, type: "button", children: "Cerrar" })] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { className: clsx("rounded-lg px-3 py-2 text-sm font-semibold", activeTab === "chat" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"), onClick: () => setTab("chat"), type: "button", children: "Chat" }), _jsx("button", { className: clsx("rounded-lg px-3 py-2 text-sm font-semibold", activeTab === "tasks" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"), onClick: () => setTab("tasks"), type: "button", children: "Tareas" })] })] }), activeTab === "chat" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex-1 space-y-3 overflow-y-auto p-4", children: [session?.messages.map((entry, index) => (_jsx("div", { className: clsx("max-w-[90%] rounded-2xl px-4 py-3 text-sm", entry.role === "user" && "ml-auto rounded-br-sm bg-blue-600 text-white", entry.role === "assistant" && "rounded-bl-sm bg-gray-700 text-gray-100", entry.role === "tool" && "border border-gray-600 bg-gray-900 text-xs text-gray-400"), children: entry.content }, `${entry.role}-${index}`))), session?.proposals
                                        ?.filter((proposal) => proposal.status === "PENDING")
                                        .map((proposal) => (_jsx(HermesProposalCard, { proposal: proposal, onConfirm: (proposalId) => confirmProposalMutation.mutate(proposalId), onReject: (proposalId) => rejectProposalMutation.mutate(proposalId) }, proposal.id)))] }), _jsx("form", { className: "border-t border-gray-700 p-4", onSubmit: (event) => {
                                    event.preventDefault();
                                    if (!message.trim() || !sessionId) {
                                        return;
                                    }
                                    sendMessageMutation.mutate(message.trim());
                                    setMessage("");
                                }, children: _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500", onChange: (event) => setMessage(event.target.value), placeholder: "Escribe a Hermes...", value: message }), _jsx("button", { className: "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white", type: "submit", children: "Enviar" })] }) })] })) : (_jsx("div", { className: "flex-1 space-y-3 overflow-y-auto p-4", children: tasksQuery.data?.tasks.map((task) => (_jsxs("article", { className: "rounded-xl border border-gray-700 bg-gray-900/60 p-4", children: [_jsx("p", { className: "text-sm font-semibold text-gray-100", children: task.title }), _jsx("p", { className: "mt-2 text-sm text-gray-400", children: task.summary }), _jsx("p", { className: "mt-3 text-xs uppercase tracking-wider text-blue-400", children: task.status })] }, task.id))) }))] })] }));
};
