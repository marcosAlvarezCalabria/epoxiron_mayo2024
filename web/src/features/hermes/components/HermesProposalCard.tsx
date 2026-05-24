import type { HermesProposal } from "@/domain/entities";

interface HermesProposalCardProps {
  proposal: HermesProposal;
  onConfirm: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

export const HermesProposalCard = ({
  proposal,
  onConfirm,
  onReject
}: HermesProposalCardProps) => {
  return (
    <div className="rounded-xl border border-yellow-700/50 bg-yellow-900/20 p-4">
      <p className="text-sm font-semibold text-yellow-300">{proposal.title}</p>
      <p className="mt-2 text-sm text-yellow-100">{proposal.description}</p>
      <div className="mt-3 flex gap-2">
        <button
          className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500"
          onClick={() => onConfirm(proposal.id)}
          type="button"
        >
          Confirmar
        </button>
        <button
          className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm font-semibold text-red-300"
          onClick={() => onReject(proposal.id)}
          type="button"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
};

