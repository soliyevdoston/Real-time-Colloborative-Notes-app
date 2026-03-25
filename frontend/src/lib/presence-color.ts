const palette = ["#0f766e", "#0369a1", "#7c3aed", "#ea580c", "#be123c", "#1d4ed8"];

export const colorFromId = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % palette.length;
  return palette[index];
};
