type Ret = 'void' | 'number' | 'string';
type CcallArg = 'string' | 'number';
export type AplModule = {
  ccall(name: string, ret: Ret, argTypes: CcallArg[], args: (string | number)[]): string | number;
  UTF8ToString(ptr: number): string;
};
export type ModuleInit = {
  stdout?: (byte: number | null) => void;
  stderr?: (byte: number | null) => void;
  stdin?: () => number | null;
};
export default function createModule(init?: ModuleInit): Promise<AplModule>;
