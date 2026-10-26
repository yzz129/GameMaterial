const https = require('https');
const http = require('http');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    const u = new URL(url);
                    redirectUrl = new URL(redirectUrl, u.origin).href;
                }
                return fetchUrl(redirectUrl).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function main() {
    console.log("Checking Biligame...");
    try {
        const biliRes = await fetchUrl('https://wiki.biligame.com/ys/%E7%BA%B3%E8%A5%BF%E5%A7%95');
        console.log("Biligame status:", biliRes.statusCode, "Length:", biliRes.data.length);
        const audioMatches = [...biliRes.data.matchAll(/https?:\/\/[^"'\s<>]+\.(?:ogg|mp3|wav)/gi)].map(m => m[0]);
        console.log("Biligame audio count:", audioMatches.length);
        if (audioMatches.length > 0) {
            console.log("Samples:", audioMatches.slice(0, 5));
        }
    } catch (e) {
        console.log("Biligame failed:", e.message);
    }

    console.log("\nChecking Fandom CN...");
    try {
        const fanRes = await fetchUrl('https://genshin-impact.fandom.com/wiki/Nahida/Voice-Overs/Chinese');
        console.log("Fandom status:", fanRes.statusCode, "Length:", fanRes.data.length);
        const fanAudios = [...fanRes.data.matchAll(/https?:\/\/[^"'\s<>]+\.(?:ogg|mp3|wav)/gi)].map(m => m[0]);
        console.log("Fandom audio count:", fanAudios.length);
        if (fanAudios.length > 0) {
            console.log("Fandom Samples:", fanAudios.slice(0, 5));
        }
    } catch (e) {
        console.log("Fandom failed:", e.message);
    }
}

main();
