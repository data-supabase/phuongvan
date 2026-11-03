export const weekNum = (t: string) => {
  const [w, y] = t.split('/').map(Number);
  return y * 100 + w;
};

export const normWeek = (s: string): string | null => {
  const m = s.match(/^\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/);
  return m ? `${+m[1]}/${m[2]}` : null;
};
