import type { APIRoute } from "astro";
import { getSidebar, updateSidebar } from "../../../tea/api/sidebar.js";

export const prerender = false;

export const GET: APIRoute = () => getSidebar();
export const PUT: APIRoute = ({ request }) => updateSidebar(request);
