import type { APIRoute } from "astro";
import { getSite, updateSite } from "../../../tea/api/site.js";

export const prerender = false;

export const GET: APIRoute = () => getSite();
export const PUT: APIRoute = ({ request }) => updateSite(request);
