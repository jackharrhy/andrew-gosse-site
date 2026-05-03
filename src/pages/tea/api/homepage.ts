import type { APIRoute } from "astro";
import { getHomepage, updateHomepage } from "../../../tea/api/homepage.js";

export const prerender = false;

export const GET: APIRoute = () => getHomepage();
export const PUT: APIRoute = ({ request }) => updateHomepage(request);
