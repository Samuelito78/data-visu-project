#!/usr/bin/env python3
"""Génère docs/documentation.html (page unique) à partir des fichiers Markdown.

Usage : .venv/bin/python scripts/build_doc.py
"""
import html
import os
import re
from datetime import datetime
from pathlib import Path

import markdown
from markdown.extensions.toc import slugify

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "documentation.html"

# (fichier, id de section, libellé de secours)
SOURCES = [
    ("README.md", "readme", "Présentation"),
    ("docs/utilisateurs_taches.md", "utilisateurs-taches", "Utilisateurs et tâches"),
    ("docs/workflow.md", "workflow", "Workflow"),
    ("docs/schema.md", "schema", "Schéma de données"),
    ("docs/decisions.md", "decisions", "Décisions"),
    ("docs/sources.md", "sources", "Sources"),
]
FILE_TO_ID = {(ROOT / f).resolve(): sid for f, sid, _ in SOURCES}

MERMAID_VERSION = "10.9.1"
TITLE = "Hôtel ou Airbnb ? — Documentation"
SUBTITLE = ("Documentation du projet de visualisation de données — "
            "Luca VIZIO & Samuel BOIX-SEGURA")


def flatten(tokens):
    for t in tokens:
        yield t
        yield from flatten(t.get("children", []))


def rewrite_link(href, src_dir, sid, ids):
    """Retourne (nouvel_href, externe)."""
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", href) or href.startswith("//"):
        return href, True
    path, _, frag = href.partition("#")
    frag_slug = slugify(html.unescape(frag), "-") if frag else ""
    if not path:  # ancre dans le même fichier
        if frag_slug and f"{sid}-{frag_slug}" in ids:
            return f"#{sid}-{frag_slug}", False
        return (f"#{sid}" if not frag_slug else f"#{sid}-{frag_slug}"), False
    target = Path(os.path.normpath(src_dir / html.unescape(path)))
    tsid = FILE_TO_ID.get(target)
    if tsid:
        if frag_slug and f"{tsid}-{frag_slug}" in ids:
            return f"#{tsid}-{frag_slug}", False
        return f"#{tsid}", False
    rel = os.path.relpath(target, ROOT / "docs").replace(os.sep, "/")
    return rel + (f"#{frag}" if frag else ""), False


_LISTE = re.compile(r"^( *)([-*+]|\d+[.)]) ")


def normaliser_listes(texte):
    """Adapte le Markdown « façon GitHub » à python-markdown.

    GitHub accepte une liste collée au paragraphe qui la précède, et des sous-listes indentées de
    2 espaces ; python-markdown exige une ligne vide avant la liste et une indentation de 4 espaces.
    On double donc l'indentation des lignes de liste (et de leurs lignes de continuation), et on
    insère une ligne vide avant le premier élément d'une liste. Les blocs de code sont laissés tels quels.
    """
    sortie, dans_code, dans_liste, precedente = [], False, False, ""
    for ligne in texte.split("\n"):
        if ligne.lstrip().startswith("```"):
            dans_code = not dans_code
            sortie.append(ligne)
            precedente = ligne
            continue
        if dans_code:
            sortie.append(ligne)
            continue
        m = _LISTE.match(ligne)
        if m:
            if not dans_liste and precedente.strip():
                sortie.append("")
            dans_liste = True
            sortie.append(" " * (2 * len(m.group(1))) + ligne.lstrip(" "))
        elif dans_liste and ligne.strip() and ligne.startswith(" "):
            retrait = len(ligne) - len(ligne.lstrip(" "))
            sortie.append(" " * (2 * retrait) + ligne.lstrip(" "))
        else:
            # Une ligne vide ne ferme pas la liste ; une ligne de texte non indentée la ferme.
            if ligne.strip():
                dans_liste = False
            sortie.append(ligne)
        precedente = ligne
    return "\n".join(sortie)


def convert(rel, sid, fallback):
    path = ROOT / rel
    md = markdown.Markdown(
        extensions=["tables", "fenced_code", "toc", "sane_lists", "attr_list"],
        extension_configs={"toc": {"slugify": slugify}},
    )
    body = md.convert(normaliser_listes(path.read_text(encoding="utf-8")))
    tokens = list(flatten(md.toc_tokens))
    return path, md, body, tokens


def main():
    parsed = []
    for rel, sid, fallback in SOURCES:
        if not (ROOT / rel).is_file():
            print(f"[ignoré] fichier absent : {rel}")
            continue
        path, md, body, tokens = convert(rel, sid, fallback)
        # ids de titres préfixés
        body = re.sub(r'(<h[1-6] id=")([^"]*)"',
                      lambda m: f'{m.group(1)}{sid}-{m.group(2)}"', body)
        ids = {f"{sid}-{t['id']}" for t in tokens}
        parsed.append((rel, sid, fallback, path, body, tokens, ids))
        print(f"[ok] {rel}")

    all_ids = set().union(*[p[6] for p in parsed]) if parsed else set()

    sections, toc = [], []
    for rel, sid, fallback, path, body, tokens, ids in parsed:
        src_dir = path.parent

        def fix_a(m, src_dir=src_dir, sid=sid):
            attrs = m.group(1)
            hm = re.search(r'href="([^"]*)"', attrs)
            if not hm:
                return m.group(0)
            new, ext = rewrite_link(hm.group(1), src_dir, sid, all_ids)
            attrs = attrs.replace(hm.group(0), f'href="{new}"')
            if ext:
                attrs += ' target="_blank" rel="noopener noreferrer"'
            return f"<a {attrs}>"
        body = re.sub(r"<a ([^>]*)>", fix_a, body)

        # Mermaid
        body = re.sub(
            r'<pre><code class="language-mermaid">(.*?)</code></pre>',
            lambda m: f'<pre class="mermaid">{m.group(1)}</pre>',
            body, flags=re.S)
        # Tableaux défilables
        body = body.replace("<table>", '<div class="table-wrap"><table>')
        body = body.replace("</table>", "</table></div>")

        h1 = next((t for t in tokens if t["level"] == 1), None)
        label = html.unescape(re.sub(r"<[^>]+>", "", h1["name"])) if h1 else fallback
        if h1:
            title_html = ""
        else:
            title_html = f'<h1 class="sec-title" id="{sid}-titre">{html.escape(fallback)}</h1>\n'
        sections.append(f'<section id="{sid}" class="doc-section">\n{title_html}{body}\n</section>')

        subs = "".join(
            f'<li><a href="#{sid}-{t["id"]}">{html.escape(html.unescape(t["name"]))}</a></li>'
            for t in tokens if t["level"] == 2)
        sub_html = f"<ul>{subs}</ul>" if subs else ""
        toc.append(f'<li class="toc-sec"><a href="#{sid}" data-sec="{sid}">{html.escape(label)}</a>{sub_html}</li>')

    toc_html = "<ul>" + "".join(toc) + "</ul>"
    date = datetime.now().strftime("%d/%m/%Y à %H:%M")
    page = TEMPLATE.format(
        title=html.escape(TITLE), subtitle=html.escape(SUBTITLE), date=date,
        toc=toc_html, sections="\n".join(sections), mermaid=MERMAID_VERSION,
        css=CSS, js=JS)
    OUT.write_text(page, encoding="utf-8")
    print(f"Écrit : {OUT.relative_to(ROOT)} ({len(parsed)} sections)")


CSS = """
:root{--bg:#fbfbfa;--fg:#1f2328;--muted:#656d76;--border:#d8dce0;--soft:#f0f2f4;--stripe:#f6f7f8;
--code-bg:#eef0f2;--accent:#0b5cad;--accent-bg:#e4eefa;--side-bg:#f4f5f6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15181c;--fg:#e2e5e9;--muted:#9aa3ad;
--border:#343a41;--soft:#232830;--stripe:#1a1e23;--code-bg:#232830;--accent:#6cb0ff;--accent-bg:#1e3350;--side-bg:#1a1d22}}
:root[data-theme="dark"]{--bg:#15181c;--fg:#e2e5e9;--muted:#9aa3ad;--border:#343a41;--soft:#232830;
--stripe:#1a1e23;--code-bg:#232830;--accent:#6cb0ff;--accent-bg:#1e3350;--side-bg:#1a1d22}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:1rem}
body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
line-height:1.6;font-size:1rem;overflow-wrap:break-word}
a{color:var(--accent)}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em}
code{background:var(--code-bg);padding:.1em .35em;border-radius:4px}
pre{background:var(--code-bg);padding:.8rem 1rem;border-radius:6px;overflow-x:auto;line-height:1.45}
pre code{background:none;padding:0}
pre.mermaid{background:none;text-align:center;font-family:inherit}
.layout{padding:0 16px}
.sidebar{font-size:.9rem}
.sidebar details{margin:1rem 0;border:1px solid var(--border);border-radius:6px;padding:.5rem .8rem;background:var(--side-bg)}
.sidebar summary{cursor:pointer;font-weight:600}
.sidebar ul{list-style:none;margin:.3rem 0;padding:0}
.sidebar ul ul{padding-left:.9rem;margin:.1rem 0 .4rem}
.sidebar a{display:block;padding:.15rem .5rem;color:var(--fg);text-decoration:none;border-left:2px solid transparent}
.sidebar a:hover{background:var(--soft)}
.sidebar .toc-sec>a{font-weight:600;margin-top:.3rem}
.sidebar ul ul a{color:var(--muted);font-size:.85rem}
.sidebar a.active{border-left-color:var(--accent);background:var(--accent-bg);color:var(--accent)}
.tools{display:flex;gap:.6rem;align-items:center;margin-top:.6rem;font-size:.85rem}
.tools button{font:inherit;background:var(--soft);color:var(--fg);border:1px solid var(--border);border-radius:5px;padding:.2rem .6rem;cursor:pointer}
.tools a{display:inline;border:0;padding:0;color:var(--muted)}
header.top{max-width:46rem;margin:0 auto;padding:1.5rem 0 .5rem}
header.top h1{margin:0 0 .3rem;font-size:2rem;line-height:1.2}
header.top p{margin:.1rem 0;color:var(--muted)}
main{max-width:46rem;margin:0 auto;padding-bottom:4rem;min-width:0}
.doc-section{padding-top:1rem;margin-top:2.5rem;border-top:2px solid var(--border)}
.doc-section:first-of-type{margin-top:1.5rem}
.doc-section>h1:first-child{font-size:2rem;line-height:1.2;margin:.5rem 0 1rem}
h1{font-size:1.8rem}
h2{font-size:1.45rem;margin:2.2rem 0 .6rem;padding-bottom:.25rem;border-bottom:1px solid var(--border)}
h3{font-size:1.2rem;margin:1.8rem 0 .5rem}
h4{font-size:1.05rem;margin:1.4rem 0 .4rem}
h5,h6{font-size:1rem;margin:1.2rem 0 .3rem;color:var(--muted)}
p,ul,ol{margin:.7rem 0}
blockquote{margin:1rem 0;padding:.1rem 1rem;border-left:4px solid var(--border);color:var(--muted)}
hr{border:0;border-top:1px solid var(--border);margin:2rem 0}
img{max-width:100%}
.table-wrap{overflow-x:auto;margin:1rem 0;max-width:100%}
table{border-collapse:collapse;font-size:.9rem;width:100%}
th,td{border:1px solid var(--border);padding:.4rem .65rem;vertical-align:top;text-align:left}
th{background:var(--soft)}
tbody tr:nth-child(even){background:var(--stripe)}
.to-top{display:block;text-align:right;font-size:.8rem;margin-top:3rem}
.to-top a{color:var(--muted)}
@media (min-width:1000px){
.layout{display:grid;grid-template-columns:18rem minmax(0,1fr);gap:2rem;padding:0 24px 0 0}
.sidebar{position:sticky;top:0;height:100vh;overflow-y:auto;padding:1rem;background:var(--side-bg);border-right:1px solid var(--border)}
.sidebar details{border:0;padding:0;margin:0;background:none}
.sidebar summary{display:none}
}
@media print{
.sidebar,.to-top{display:none}
.layout{display:block;padding:0}
main,header.top{max-width:none}
.table-wrap{overflow:visible}
a{color:inherit}
a[href]:after{content:" (" attr(href) ")";font-size:.8em;color:#555;word-break:break-all}
a[href^="#"]:after{content:""}
.doc-section{break-before:page}
pre{white-space:pre-wrap}
}
"""

JS = """
(function(){
var root=document.documentElement;
try{var t=localStorage.getItem('theme');if(t)root.setAttribute('data-theme',t);}catch(e){}
function isDark(){var d=root.getAttribute('data-theme');
 if(d)return d==='dark';return window.matchMedia('(prefers-color-scheme: dark)').matches;}
function initMermaid(){
 if(!window.mermaid)return;
 mermaid.initialize({startOnLoad:true,theme:isDark()?'dark':'default',securityLevel:'strict'});
}
window.addEventListener('DOMContentLoaded',function(){
 initMermaid();
 if(window.innerWidth<1000){var d=document.querySelector('.sidebar details');if(d)d.removeAttribute('open');}
 var btn=document.getElementById('theme-btn');
 btn.addEventListener('click',function(){
  var n=isDark()?'light':'dark';root.setAttribute('data-theme',n);
  try{localStorage.setItem('theme',n);}catch(e){}
  location.reload();
 });
 var links={};
 document.querySelectorAll('.sidebar a[data-sec]').forEach(function(a){links[a.dataset.sec]=a;});
 var secs=document.querySelectorAll('section.doc-section');
 if('IntersectionObserver' in window){
  var io=new IntersectionObserver(function(es){
   es.forEach(function(e){if(e.isIntersecting){
    Object.values(links).forEach(function(a){a.classList.remove('active');});
    if(links[e.target.id])links[e.target.id].classList.add('active');}});
  },{rootMargin:'0px 0px -70% 0px'});
  secs.forEach(function(s){io.observe(s);});
 }
});
})();
"""

TEMPLATE = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{css}</style>
</head>
<body id="top">
<div class="layout">
<nav class="sidebar" aria-label="Table des matières">
<details open>
<summary>Table des matières</summary>
{toc}
<div class="tools"><button type="button" id="theme-btn">Clair / sombre</button><a href="#top">Haut de page</a></div>
</details>
</nav>
<div>
<header class="top">
<h1>{title}</h1>
<p>{subtitle}</p>
<p>Généré le {date}</p>
</header>
<main>
{sections}
<p class="to-top"><a href="#top">Haut de page</a></p>
</main>
</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@{mermaid}/dist/mermaid.min.js"></script>
<script>{js}</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
