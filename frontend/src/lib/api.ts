const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const apiUrl = (path: string): string => {
  if (path.startsWith("/")) {
    return API_BASE_URL + path;
  }

  return API_BASE_URL + "/" + path;
};

export const parseApiError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? "Request failed";
  } catch {
    return "Request failed";
  }
};
