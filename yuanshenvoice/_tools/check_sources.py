import urllib.request
import re
import json

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'}

def check_fandom_cn():
    url = 'https://genshin-impact.fandom.com/wiki/Nahida/Voice-Overs/Chinese'
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            # find audio sources
            audios = re.findall(r'https://static\.wikia\.nocookie\.net/gensin-impact/images/[^\s\"\'<>]+\.(?:ogg|mp3)', html, re.IGNORECASE)
            print("Fandom CN direct wikia matches:", len(audios))
            all_ogg = re.findall(r'href="([^"]+\.ogg[^"]*)"', html, re.IGNORECASE)
            print("Fandom all ogg hrefs:", len(all_ogg))
            if all_ogg:
                print("Sample ogg:", all_ogg[:3])
            # search for audio tag src
            srcs = re.findall(r'src="([^"]+\.(?:ogg|mp3)[^"]*)"', html, re.IGNORECASE)
            print("Fandom audio srcs:", len(srcs))
            if srcs:
                print("Sample src:", srcs[:3])
    except Exception as e:
        print("Fandom error:", e)

def check_biligame():
    url = 'https://wiki.biligame.com/ys/%E7%BA%B3%E8%A5%BF%E5%A7%95'
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            audios = re.findall(r'https?://[^\s\"\'<>]+\.(?:ogg|mp3|wav)', html)
            print("Biligame audio urls:", len(audios))
            if audios:
                print("Sample biligame:", audios[:5])
            # check media/audio tags or data attributes
            data_audios = re.findall(r'data-[^=]*="([^"]+\.(?:ogg|mp3|wav))"', html)
            print("Biligame data audios:", len(data_audios))
            if data_audios:
                print("Sample data audio:", data_audios[:5])
    except Exception as e:
        print("Biligame error:", e)

if __name__ == '__main__':
    print("Testing Fandom...")
    check_fandom_cn()
    print("Testing Biligame...")
    check_biligame()
