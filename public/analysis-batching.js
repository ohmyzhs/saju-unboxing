function chunkSections(sections, size = 2) {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("묶음 크기는 1 이상의 정수여야 합니다.");
  }
  const chunks = [];
  for (let index = 0; index < sections.length; index += size) {
    chunks.push(sections.slice(index, index + size));
  }
  return chunks;
}

globalThis.AnalysisBatching = Object.freeze({ chunkSections });
