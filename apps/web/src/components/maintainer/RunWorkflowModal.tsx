import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RiPlayCircleLine, RiCloseLine } from 'react-icons/ri';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { Button } from '#/components/Button';
import { Input } from '#/components/Input';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-mock-rise">
      <div className="w-full max-w-md border border-white/[0.1] bg-[#15171d] shadow-2xl p-6 flex flex-col rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#118af3]/15 text-[#118af3] border border-[#118af3]/25">
                <RiPlayCircleLine className="text-sm" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-white">
                Run Agent on GitHub Issue
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              Trigger autonomous root-cause triage, sandbox verification, and PR creation.
            </p>
          </div>

          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition"
            onClick={onClose}
          >
            <RiCloseLine className="text-lg" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-1">
            <Input
              label="GitHub Issue URL"
              placeholder="https://github.com/owner/repo/issues/42"
              {...register('issueUrl')}
              isInvalid={!!errors.issueUrl}
              errorMessage={errors.issueUrl?.message}
              description="The maintainer agent will triage the issue, test in Daytona sandbox, and draft a pull request."
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.08]">
            <Button
              variant="secondary"
              className="tembo-btn-secondary h-8 px-4 text-xs"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              isLoading={startWorkflowMutation.isPending}
              className="tembo-btn-primary h-8 px-4 text-xs font-bold shadow-md"
            >
              Start Investigation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
