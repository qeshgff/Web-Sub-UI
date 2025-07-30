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
                trimmed.startsWith('ss://') ||
                trimmed.startsWith('trojan://') ||
                trimmed.startsWith('hy2://') ||
                trimmed.startsWith('http://') ||
                trimmed.startsWith('https://')
            );
        });

        if (validNodes.length === 0) {
            return new Response('No valid nodes found', { 
                status: 404,
                headers: corsHeaders
            });
        }

        const nodes = validNodes.join('\n');

        // 根据目标格式处理
        if (target === 'base64') {
            // 直接返回Base64编码的节点
            const encoded = btoa(unescape(encodeURIComponent(nodes)));
            return new Response(encoded, {
                headers: { 
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600',
                    'Content-Disposition': `attachment; filename="${group.name}-${target}.txt"`,
                    ...corsHeaders
                }
            });
        }

        // 其他格式通过订阅转换API处理
        const api = group.api || env.DEFAULT_API || 'https://sub.cmliussss.com';
        
        // 构建转换URL
        let convertUrl;
        const encodedNodes = encodeURIComponent(btoa(unescape(encodeURIComponent(nodes))));
        
        if (target === 'clash') {
            convertUrl = `${api}/sub?target=clash&url=${encodedNodes}&config=https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini`;
        } else if (target === 'v2ray') {
            convertUrl = `${api}/sub?target=v2ray&url=${encodedNodes}`;
        } else if (target === 'singbox') {
            convertUrl = `${api}/sub?target=singbox&url=${encodedNodes}`;
        } else if (target === 'surge') {
            convertUrl = `${api}/sub?target=surge&url=${encodedNodes}`;
        } else {
            convertUrl = `${api}/sub?target=${target}&url=${encodedNodes}`;
        }

        // 添加自定义参数
        if (clientType) {
            convertUrl += `&client=${clientType}`;
        }

        // 调用订阅转换API
        const convertResponse = await fetch(convertUrl, {
            headers: {
                'User-Agent': 'CF-Workers-SUB/1.0'
            }
        });

        if (!convertResponse.ok) {
            throw new Error(`Conversion API error: ${convertResponse.status}`);
        }

        const content = await convertResponse.text();
        const contentType = convertResponse.headers.get('Content-Type') || 'text/plain; charset=utf-8';

        return new Response(content, {
            headers: { 
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Content-Disposition': `attachment; filename="${group.name}-${target}.${getFileExtension(target)}"`,
                ...corsHeaders
            }
        });

    } catch (error) {
        console.error('Subscription generation error:', error);
        
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        }), { 
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
}

// 根据目标格式获取文件扩展名
function getFileExtension(target) {
    const extensions = {
        'clash': 'yaml',
        'v2ray': 'txt',
        'singbox': 'json',
        'surge': 'conf',
        'base64': 'txt'
    };
    return extensions[target] || 'txt';
}

export async function onRequestOptions(context) {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}
