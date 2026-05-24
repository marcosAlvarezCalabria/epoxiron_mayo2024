import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHermesSession,
  getHermesSession,
  sendHermesMessage,
  confirmHermesProposal,
  rejectHermesProposal
} from "@/application/use-cases";

export const useHermesSession = (sessionId?: string) => {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["hermes-session", sessionId],
    queryFn: async () => getHermesSession(sessionId!),
    enabled: Boolean(sessionId)
  });

  const createSessionMutation = useMutation({
    mutationFn: createHermesSession
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => sendHermesMessage(sessionId!, content),
    onSuccess: (data) => {
      queryClient.setQueryData(["hermes-session", sessionId], data);
      void queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const confirmProposalMutation = useMutation({
    mutationFn: confirmHermesProposal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hermes-session", sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const rejectProposalMutation = useMutation({
    mutationFn: rejectHermesProposal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hermes-session", sessionId] });
    }
  });

  return {
    sessionQuery,
    createSessionMutation,
    sendMessageMutation,
    confirmProposalMutation,
    rejectProposalMutation
  };
};

