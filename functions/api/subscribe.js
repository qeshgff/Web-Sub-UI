// functions/api/subscribe.js
// Cloudflare Pages Functions API for subscription generation

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const target = url.searchParams.get('target') || 'base64';
    const clientType = url.searchParams.get('client') || '';
    
    // 添加CORS头
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (!token) {
        return new Response('Token is required', { 
            status: 400,
            headers: corsHeaders
        });
    }
    
    try {
        // 从KV存储获取分组数据
        const data = await env.SUBSCRIPTION_KV.get('groups');
        const groups = data ? JSON.parse(data) : [];
        const group = groups.find(g => g.token === token);
        
        if (!group) {
            return new Response('Token not found', { 
                status: 404,
                headers: corsHeaders
            });
        }
        
        // 过滤有效的节点链接
        const validNodes = group.nodes.filter(node => {
            const trimmed = node.trim();
            return trimmed && (
                trimmed.startsWith('vless://') ||
                trimmed.startsWith('vmess://') ||
