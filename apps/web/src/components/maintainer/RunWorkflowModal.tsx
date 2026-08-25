import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RiPlayCircleLine } from 'react-icons/ri';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';

const workflowSchema = z.object({
  issueUrl: z
    .string()
    .min(1, 'Issue URL is required')
    .regex(/^https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+/i, 'Must be a valid GitHub Issue URL (e.g. https://github.com/owner/repo/issues/12)'),
});

type WorkflowFormValues = z.infer<typeof workflowSchema>;

interface RunWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (issueNumber?: number) => void;
}

export function RunWorkflowModal({ isOpen, onClose, onSuccess }: RunWorkflowModalProps) {
  const queryClient = useQueryClient();

  const startWorkflowMutation = useMutation(
    orpc.maintainer.startWorkflow.mutationOptions({
      onSuccess: (res: any) => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getIssues.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSinceLastVisit.key() });
        reset();
        onSuccess(res?.issue?.number);
        onClose();
      },
    })
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      issueUrl: '',
    },
  });

  if (!isOpen) return null;

  const onSubmit = (values: WorkflowFormValues) => {
    startWorkflowMutation.mutate({ issueUrl: values.issueUrl });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <RiPlayCircleLine className="text-cyan-400 text-lg" /> Run Agent on GitHub Issue
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">GitHub Issue URL</label>
            <input
              type="text"
              placeholder="https://github.com/owner/repo/issues/42"
              {...register('issueUrl')}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
            />
            {errors.issueUrl && (
              <p className="mt-1 text-[11px] text-red-400">{errors.issueUrl.message}</p>
            )}
            <p className="mt-1 text-[11px] text-slate-500">
              The agent will triage the issue, clone the repo in a sandbox, reproduce the bug, and propose a pull request!
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={startWorkflowMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {startWorkflowMutation.isPending ? 'Starting Agent...' : 'Start Investigation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
