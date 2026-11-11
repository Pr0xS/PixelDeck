declare module 'bidi-js' {
  interface Embedding { levels: Uint8Array; paragraphs: { start: number; end: number; level: number }[] }
  export default function bidiFactory(): {
    getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl'): Embedding
    getReorderSegments(text: string, embedding: Embedding, start?: number, end?: number): [number, number][]
  }
}
