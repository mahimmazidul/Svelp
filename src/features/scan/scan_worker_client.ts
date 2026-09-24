import type { bal_ProcessorInput, bal_ProcessorResult } from '../../services/scan_service';
import type { ScanWorkerRequest, ScanWorkerResponse } from './scan_worker';

export interface bal_WorkerHandle {
  process: (bal_input: bal_ProcessorInput) => Promise<bal_ProcessorResult>;
  dispose: () => void;
}

export function bal_worker_available(): boolean {
  return typeof Worker !== 'undefined';
}

export function bal_create_worker_processor(): bal_WorkerHandle {
  const bal_worker = new Worker(new URL('./scan_worker.ts', import.meta.url), { type: 'module' });
  let bal_next_job = 1;
  const bal_pending = new Map<
    number,
    { resolve: (bal_result: bal_ProcessorResult) => void; reject: (bal_error: Error) => void }
  >();
  bal_worker.onmessage = (bal_event: MessageEvent<ScanWorkerResponse>) => {
    const bal_msg = bal_event.data;
    const bal_entry = bal_pending.get(bal_msg.jobId);
    if (!bal_entry) return;
    bal_pending.delete(bal_msg.jobId);
    if (bal_msg.type === 'done') bal_entry.resolve(bal_msg.result);
    else bal_entry.reject(new Error(bal_msg.message));
  };
  bal_worker.onerror = () => {
    for (const [bal_job_id, bal_entry] of bal_pending) {
      bal_entry.reject(new Error('The scanning engine stopped unexpectedly.'));
      bal_pending.delete(bal_job_id);
    }
  };
  return {
    process: (bal_input: bal_ProcessorInput) =>
      new Promise<bal_ProcessorResult>((bal_resolve, bal_reject) => {
        const bal_job_id = bal_next_job++;
        bal_pending.set(bal_job_id, { resolve: bal_resolve, reject: bal_reject });
        const bal_request: ScanWorkerRequest = { type: 'process', jobId: bal_job_id, input: bal_input };
        const bal_copy: bal_ProcessorInput = {
          ...bal_input,
          imageData: {
            data: new Uint8ClampedArray(bal_input.imageData.data),
            width: bal_input.imageData.width,
            height: bal_input.imageData.height
          }
        };
        bal_worker.postMessage(bal_request, [bal_copy.imageData.data.buffer]);
      }),
    dispose: () => {
      bal_worker.terminate();
      for (const [bal_job_id, bal_entry] of bal_pending) {
        bal_entry.reject(new Error('Processing was cancelled.'));
        bal_pending.delete(bal_job_id);
      }
    }
  };
}
