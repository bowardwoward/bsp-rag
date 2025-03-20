import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
        throw error(400, 'URL parameter is required');
    }

    try {
        const response = await fetch(targetUrl);
        
        if (!response.ok) {
            throw error(response.status, response.statusText);
        }

        const contentType = response.headers.get('content-type');
        const data = await response.arrayBuffer();

        return new Response(data, {
            headers: {
                'Content-Type': contentType || 'application/pdf'
            }
        });
    } catch (e) {
        throw error(500, 'Failed to fetch PDF');
    }
};