export interface CandidateWeight { name: string; weightPercent: number; }

export function extractCandidateWeights(text: string): CandidateWeight[] {
  const rows = text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z][A-Za-z &/()-]{1,80}?)\s*[:\-]?\s*(\d{1,3}(?:\.\d+)?)\s*%\s*$/);
    if (!match) return [];
    const weightPercent = Number(match[2]);
    return weightPercent >= 0 && weightPercent <= 100 ? [{ name: match[1].trim(), weightPercent }] : [];
  });
  return rows.filter((row, index) => rows.findIndex((other) => other.name.toLowerCase() === row.name.toLowerCase()) === index);
}

export function candidateWeightsAreComplete(weights: CandidateWeight[]) {
  return Math.abs(weights.reduce((sum, weight) => sum + weight.weightPercent, 0) - 100) < 0.001;
}
