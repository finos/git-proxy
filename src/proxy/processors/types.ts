import { Action } from "../actions";

export interface Processor {
  exec(req: any, action: Action): Promise<Action>;
  metadata: ProcessorMetadata;
}

export interface ProcessorMetadata {
  displayName: string;
}

export type CommitContent = {
  item: number;
  value: number;
  type: number;
  size: number;
  deflatedSize: number;
  objectRef: any;
  content: string;
}
