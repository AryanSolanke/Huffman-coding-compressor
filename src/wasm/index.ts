import { initWasm, isWasmLoaded } from '../wasm/daaWrapper';

export async function useWasm() {
  try {
    await initWasm();
    return isWasmLoaded();
  } catch {
    return false;
  }
}
