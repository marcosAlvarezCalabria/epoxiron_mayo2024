import { useEffect, useState } from "react";
import clsx from "clsx";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { useHermesStore } from "@/features/hermes/store/hermesStore";
import { useHermesSession } from "@/features/hermes/hooks/useHermesSession";
import { useHermesTasks } from "@/features/hermes/hooks/useHermesTasks";
import { HermesProposalCard } from "@/features/hermes/components/HermesProposalCard";

export const HermesPanel = () => {
  const { isOpen, toggleOpen, activeTab, setTab } = useHermesStore();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const {
    sessionQuery,
    createSessionMutation,
    sendMessageMutation,
    confirmProposalMutation,
    rejectProposalMutation
  } = useHermesSession(sessionId);
  const tasksQuery = useHermesTasks();

  useEffect(() => {
    if (!sessionId && isOpen && !createSessionMutation.isPending) {
      void createSessionMutation.mutateAsync().then((session) => {
        setSessionId(session.sessionId);
      });
    }
  }, [createSessionMutation, isOpen, sessionId]);

  const session = sessionQuery.data;

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-40 rounded-full bg-blue-600 p-4 text-white shadow-lg hover:bg-blue-500"
        onClick={toggleOpen}
        type="button"
      >
        <SparklesIcon className="h-6 w-6" />
      </button>

      <aside
        className={clsx(
          "fixed right-0 top-0 z-30 flex h-screen w-full max-w-md flex-col border-l border-gray-700 bg-gray-800 shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="border-b border-gray-700 bg-gray-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-100">Hermes</h2>
              <p className="text-sm text-gray-400">Agente operativo de Epoxiron</p>
            </div>
            <button className="text-sm text-gray-400" onClick={toggleOpen} type="button">
              Cerrar
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className={clsx(
                "rounded-lg px-3 py-2 text-sm font-semibold",
                activeTab === "chat" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
              )}
              onClick={() => setTab("chat")}
              type="button"
            >
              Chat
            </button>
            <button
              className={clsx(
                "rounded-lg px-3 py-2 text-sm font-semibold",
                activeTab === "tasks" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
              )}
              onClick={() => setTab("tasks")}
              type="button"
            >
              Tareas
            </button>
          </div>
        </header>

        {activeTab === "chat" ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {session?.messages.map((entry, index) => (
                <div
                  className={clsx(
                    "max-w-[90%] rounded-2xl px-4 py-3 text-sm",
                    entry.role === "user" && "ml-auto rounded-br-sm bg-blue-600 text-white",
                    entry.role === "assistant" && "rounded-bl-sm bg-gray-700 text-gray-100",
                    entry.role === "tool" && "border border-gray-600 bg-gray-900 text-xs text-gray-400"
                  )}
                  key={`${entry.role}-${index}`}
                >
                  {entry.content}
                </div>
              ))}

              {session?.proposals
                ?.filter((proposal) => proposal.status === "PENDING")
                .map((proposal) => (
                  <HermesProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onConfirm={(proposalId) => confirmProposalMutation.mutate(proposalId)}
                    onReject={(proposalId) => rejectProposalMutation.mutate(proposalId)}
                  />
                ))}
            </div>

            <form
              className="border-t border-gray-700 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!message.trim() || !sessionId) {
                  return;
                }
                sendMessageMutation.mutate(message.trim());
                setMessage("");
              }}
            >
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Escribe a Hermes..."
                  value={message}
                />
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                  type="submit"
                >
                  Enviar
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {tasksQuery.data?.tasks.map((task) => (
              <article className="rounded-xl border border-gray-700 bg-gray-900/60 p-4" key={task.id}>
                <p className="text-sm font-semibold text-gray-100">{task.title}</p>
                <p className="mt-2 text-sm text-gray-400">{task.summary}</p>
                <p className="mt-3 text-xs uppercase tracking-wider text-blue-400">{task.status}</p>
              </article>
            ))}
          </div>
        )}
      </aside>
    </>
  );
};

