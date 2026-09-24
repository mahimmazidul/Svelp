import { bal_process_image, type bal_EngineInput } from './scan_engine';

export type ScanWorkerRequest = {
  type: 'process';
  jobId: number;
  input: bal_EngineInput;
};

export type ScanWorkerResponse =
  | {
      type: 'done';
      jobId: number;
      result: ReturnType<typeof bal_process_image>;
    }
  | {
      type: 'error';
      jobId: number;
      message: string;
    };

self.onmessage = (bal_event: MessageEvent<ScanWorkerRequest>) => {
  const bal_msg = bal_event.data;
  if (!bal_msg || bal_msg.type !== 'process') return;
  try {
    const bal_result = bal_process_image(bal_msg.input);
    const bal_transfer: ArrayBuffer[] =
      bal_result.normalized && bal_result.normalized.data.buffer
        ? [bal_result.normalized.data.buffer as ArrayBuffer]
        : [];
    (self as unknown as Worker).postMessage(
      {
        type: 'done',
        jobId: bal_msg.jobId,
        result: bal_result
      },
      bal_transfer
    );
  } catch (bal_error) {
    const bal_message =
      bal_error instanceof Error ? bal_error.message : 'The page could not be processed.';
    (self as unknown as Worker).postMessage({
      type: 'error',
      jobId: bal_msg.jobId,
      message: bal_message
    });
  }
};
