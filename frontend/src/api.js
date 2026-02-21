import { API_URL } from "./api/config";

export async function healthCheck() {
    const res = await fetch(`${API_URL}/health`);
    return res.json();
}