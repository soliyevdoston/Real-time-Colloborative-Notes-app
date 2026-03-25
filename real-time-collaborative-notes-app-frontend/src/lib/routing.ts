export const normalizeNextPath = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  return value.startsWith("/") ? value : null;
};

export const routeParamToString = (value: string | string[] | undefined): string => {
  if (!value) {
    return "";
  }

  return Array.isArray(value) ? value[0] ?? "" : value;
};
